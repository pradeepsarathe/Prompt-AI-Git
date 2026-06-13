// functions/send-digest.js
// Cloudflare Pages Function — builds a PromptAI briefing email
// (5 news + 5 blogs + 1 research paper) from live feeds and sends it via Resend.
//
// v2 — IMAGE-LED "Netflix-grade" briefing:
//   • Pulls a thumbnail/hero image from each feed item (media:content,
//     media:thumbnail, enclosure, <img> in content:encoded/description, etc.)
//   • Cinematic hero for the top story, poster-thumbnail cards for the rest.
//   • Always degrades gracefully to a branded gradient poster when a feed
//     gives no usable image — so the layout never looks broken.
//
// Two ways it's used:
//   1. Recurring send to ALL subscribers. While testing we run it HOURLY:
//        GET  https://promptai.in/send-digest?key=YOUR_CRON_SECRET
//      Schedule it every hour with a free scheduler (cron-job.org) or a
//      Cloudflare Worker Cron Trigger hitting this URL.  Change the frequency
//      later just by changing the schedule — no code change needed.
//   2. Single send to one new subscriber (called by subscribe.js on signup):
//        GET  https://promptai.in/send-digest?key=YOUR_CRON_SECRET&to=user@example.com
//
// Required (Pages → Settings → Functions):
//   KV binding   SUBSCRIBERS
//   Secret       RESEND_API_KEY     (from resend.com)
//   Variable     FROM_EMAIL         e.g.  PromptAI <briefing@promptai.in>
//   Secret       CRON_SECRET        any long random string

// ── feed sources — single shared module (R2) ────────────────────────
import { DIGEST_NEWS_FEEDS as NEWS_FEEDS, DIGEST_BLOG_FEEDS as BLOG_FEEDS, DIGEST_PAPER_FEEDS as PAPER_FEEDS } from './lib/sources.js';
import { fetchFeedItems as libFetchFeedItems, withTimeout, truncate, domainOf, unsubscribeUrl } from './lib/feedlib.js';

export async function onRequest(context) {
  const { request, env } = context;
  const url = new URL(request.url);

  // ── auth ──
  // Preferred: Authorization: Bearer <CRON_SECRET> (query strings end up in
  // logs/history). ?key= still works for existing cron-job.org schedules —
  // migrate it when convenient.
  const authz = request.headers.get('Authorization') || '';
  const presentedKey = authz.startsWith('Bearer ')
    ? authz.slice(7).trim()
    : (url.searchParams.get('key') || '');
  if (!env.CRON_SECRET || presentedKey !== env.CRON_SECRET) {
    return json({ error: 'Unauthorized' }, 401);
  }
  if (!env.RESEND_API_KEY || !env.FROM_EMAIL) {
    return json({ error: 'Email not configured (RESEND_API_KEY / FROM_EMAIL)' }, 503);
  }

  // Everything below is wrapped so a feed/Resend hiccup returns readable JSON
  // instead of an opaque Cloudflare 502.
  try {
  // ── content: 5 news + 5 blogs + 1 paper ──
  const content = await fetchDigestContent();
  if (content.news.length + content.blogs.length === 0 && !content.paper) {
    return json({ error: 'No content available right now (all feeds failed)' }, 200);
  }

  const dateStr = new Date().toLocaleString('en-US', {
    month: 'short', day: 'numeric', hour: 'numeric', minute: '2-digit',
  });
  const headline = content.news[0]?.title || content.blogs[0]?.title || 'Latest in AI';
  const subject = `🧠 Your PromptAI briefing · ${headline.slice(0, 48)}`;

  // ── recipients: either one ?to= address, or every subscriber ──
  const single = (url.searchParams.get('to') || '').trim().toLowerCase();
  let emails;
  if (single) {
    emails = [single];
  } else {
    if (!env.SUBSCRIBERS) return json({ error: 'No SUBSCRIBERS KV binding' }, 503);
    emails = [];
    let cursor;
    do {
      const page = await env.SUBSCRIBERS.list({ cursor, limit: 1000 });
      page.keys.forEach(k => emails.push(k.name));
      cursor = page.list_complete ? null : page.cursor;
    } while (cursor);
  }
  // Never treat bookkeeping keys as subscribers: rate limits ("rl:"),
  // unconfirmed double-opt-in signups ("pending:"), ops metadata ("meta:").
  emails = emails.filter(e => e && !e.startsWith('rl:') && !e.startsWith('pending:') && !e.startsWith('meta:'));

  // ── Frequency filter (review #3/#8) ──
  //   ?freq=daily  → only subscribers who chose the daily briefing
  //   ?freq=weekly → weekly subscribers (the default for everyone who never chose)
  //   no ?freq=    → everyone (legacy behaviour; existing cron keeps working)
  // Cron setup: keep the Tuesday schedule and add &freq=weekly to it, then add
  // a daily schedule with &freq=daily.
  const wantFreq = (url.searchParams.get('freq') || '').trim().toLowerCase();
  if (!single && (wantFreq === 'daily' || wantFreq === 'weekly') && env.SUBSCRIBERS) {
    const keep = [];
    for (let i = 0; i < emails.length; i += 50) {
      const chunk = emails.slice(i, i + 50);
      const recs = await Promise.all(chunk.map(e => env.SUBSCRIBERS.get(e).catch(() => null)));
      recs.forEach((raw, k) => {
        let f = 'weekly';
        try { const d = JSON.parse(raw || '{}'); if (d.frequency === 'daily') f = 'daily'; } catch (e) {}
        if (f === wantFreq) keep.push(chunk[k]);
      });
    }
    emails = keep;
  }
  if (emails.length === 0) return json({ sent: 0, message: 'No subscribers yet' + (wantFreq ? ' for freq=' + wantFreq : '') });

  // Snapshot today's issue so it's readable (and rankable) on the web at
  // /issue/<date> — also the "read on the web" target in the email (R21/R39).
  const issueDate = new Date().toISOString().slice(0, 10);
  if (env.STATS) {
    try {
      const pickF = (s) => ({ title: s.title, url: s.link, desc: (s.desc || '').slice(0, 240), src: s.src, topic: '' });
      await env.STATS.put('issue:' + issueDate, JSON.stringify({
        date: issueDate, generatedAt: new Date().toISOString(), summary: null,
        news: content.news.map(pickF), blogs: content.blogs.map(pickF),
        paper: content.paper ? pickF(content.paper) : null,
      }));
    } catch (e) { /* non-fatal */ }
  }

  // ── send via Resend BATCH (≤100 personalized emails per request) ──
  // One HTTP request per 100 recipients keeps us under Resend's "2 requests/sec"
  // limit (the per-email loop tripped a 429). A short pause between batches
  // covers the case of >200 subscribers.
  const sleep = (ms) => new Promise((r) => setTimeout(r, ms));
  let sent = 0;
  let lastResendError = null;
  for (let i = 0; i < emails.length; i += 100) {
    const chunk = emails.slice(i, i + 100);
    const batch = await Promise.all(chunk.map(async (email) => {
      // HMAC-signed unsubscribe link (R17) — anyone WITHOUT the secret can
      // no longer unsubscribe arbitrary addresses.
      const unsub = await unsubscribeUrl(env, email);
      return {
        from: env.FROM_EMAIL,
        to: [email],
        subject,
        html: digestHtml({ ...content, dateStr, email, unsubUrl: unsub, issueDate, sponsorHtml: env.SPONSOR_HTML || '' }),
        // Plain-text alternative — HTML-only mail scores worse with spam filters.
        text: digestText({ ...content, dateStr, email, unsubUrl: unsub, issueDate }),
        // One-click unsubscribe — now required by Gmail/Yahoo for bulk senders and
        // a meaningful inbox-placement signal.
        headers: {
          'List-Unsubscribe': '<' + unsub + '>',
          'List-Unsubscribe-Post': 'List-Unsubscribe=One-Click',
        },
      };
    }));
    try {
      const r = await fetch('https://api.resend.com/emails/batch', {
        method: 'POST',
        headers: { 'Authorization': 'Bearer ' + env.RESEND_API_KEY, 'Content-Type': 'application/json' },
        body: JSON.stringify(batch),
      });
      if (r.ok) sent += chunk.length;
      else lastResendError = (await r.text()).slice(0, 300);
    } catch (e) { lastResendError = e.message; }
    if (i + 100 < emails.length) await sleep(600); // stay under 2 req/sec
  }

  // ── last-run health report (read it back any time at meta:lastRun) ──
  // Surfaces silent failures: dead feeds (0 items), Resend errors, send counts.
  if (env.SUBSCRIBERS) {
    try {
      await env.SUBSCRIBERS.put('meta:lastRun', JSON.stringify({
        at: new Date().toISOString(),
        recipients: emails.length, sent, subject, lastResendError,
        counts: { news: content.news.length, blogs: content.blogs.length, paper: content.paper ? 1 : 0 },
      }));
    } catch (e) { /* non-fatal */ }
  }

  return json({ success: true, recipients: emails.length, sent, subject, lastResendError,
    counts: { news: content.news.length, blogs: content.blogs.length, paper: content.paper ? 1 : 0 } });
  } catch (err) {
    return json({ error: 'send-digest crashed', detail: String(err && err.message || err) }, 200);
  }
}

// ── feed fetch — shared machinery lives in lib/feedlib.js (R2) ──────
async function fetchFeedItems(feed, take) {
  const items = await libFetchFeedItems(feed, take);
  // The digest templates expect { title, link, desc, img, src, date }.
  return items.map(i => ({
    title: i.title, link: i.link,
    desc: truncate(i.desc || '', 160),
    img: i.img || '', date: i.date,
    src: (i.feedTitle || domainOf(feed)),
  }));
}

// (fetchDirect / fetchViaRss2json / XML + image helpers / parseFeed /
//  withTimeout all moved to functions/lib/feedlib.js — shared with /api/feeds.)

async function mergeFeeds(feeds, perFeed, total) {
  const out = [];
  const settled = await Promise.allSettled(feeds.map(f => fetchFeedItems(f, perFeed)));
  settled.forEach(s => { if (s.status === 'fulfilled') out.push(...s.value); });
  const seen = new Set();
  return out
    .filter(b => b.link && !seen.has(b.link) && seen.add(b.link))
    .sort((a, b) => b.date - a.date)
    .slice(0, total);
}

// Pull everything the briefing needs. Each section is time-boxed so one slow
// feed can never hang the whole request (which was causing 502s).
export async function fetchDigestContent() {
  const [news, blogs, papers] = await Promise.all([
    withTimeout(mergeFeeds(NEWS_FEEDS, 5, 5), 9000, []),
    withTimeout(mergeFeeds(BLOG_FEEDS, 4, 5), 9000, []),
    withTimeout(mergeFeeds(PAPER_FEEDS, 4, 1), 9000, []),
  ]);
  return { news, blogs, paper: papers[0] || null };
}

// Back-compat helper (some callers may still import this).
export async function fetchLatestBlogs() {
  return mergeFeeds(BLOG_FEEDS, 4, 8);
}

// ── email HTML ───────────────────────────────────────────────────────
const esc = s => (s || '').replace(/&/g, '&amp;').replace(/</g, '&lt;').replace(/>/g, '&gt;');

// Branded gradient posters used when a feed item has no image. Deterministic
// per-index so a given slot always looks consistent.
const POSTERS = [
  ['#1a73e8', '#174ea6', '◆'], ['#0f766e', '#134e4a', '▲'], ['#8430ce', '#4c1d95', '●'],
  ['#b06000', '#7c2d12', '✦'], ['#1967d2', '#0a1628', '❖'], ['#137333', '#064e3b', '■'],
];

// A 150×96 poster cell: real feed image if present, else gradient + glyph.
// Fallback uses a SOLID bgcolor base (Gmail/Outlook ignore CSS gradients) with
// the gradient layered on top for clients that support it.
function poster(item, i) {
  if (item && item.img) {
    return `<img src="${esc(item.img)}" width="150" height="96" alt="" style="display:block;width:150px;height:96px;border-radius:10px;object-fit:cover;border:0;outline:0;background:#f1f3f4;" />`;
  }
  const [a, b, g] = POSTERS[i % POSTERS.length];
  return `<div style="width:150px;height:96px;border-radius:10px;background:${a};background-image:linear-gradient(135deg,${a},${b});text-align:center;line-height:96px;font-family:Georgia,serif;font-size:30px;color:rgba(255,255,255,0.9);">${g}</div>`;
}

function itemRow(b, i) {
  return `
    <tr><td style="padding:${i === 0 ? '16' : '18'}px 36px 0;">
      <table role="presentation" width="100%" cellpadding="0" cellspacing="0"><tr>
        <td width="150" valign="top" style="padding-right:16px;">${poster(b, i)}</td>
        <td valign="top" style="font-family:Helvetica,Arial,sans-serif;">
          <a href="${esc(b.link)}" style="text-decoration:none;"><div style="font-family:Georgia,serif;font-size:16px;font-weight:bold;line-height:1.35;color:#202124;">${esc(b.title)}</div></a>
          <div style="font-size:13px;line-height:1.55;color:#5f6368;margin-top:5px;">${esc(b.desc)}</div>
          <div style="font-size:11px;color:#80868b;margin-top:7px;">${esc(b.src)} &nbsp;·&nbsp; <a href="${esc(b.link)}" style="color:#1a73e8;text-decoration:none;font-weight:600;">Read →</a></div>
        </td>
      </tr></table>
    </td></tr>`;
}

function sectionHeader(kicker, meta) {
  return `
    <tr><td style="padding:30px 36px 4px;font-family:Helvetica,Arial,sans-serif;">
      <table role="presentation" width="100%" cellpadding="0" cellspacing="0"><tr>
        <td style="font-size:11px;font-weight:bold;letter-spacing:2px;text-transform:uppercase;color:#1a73e8;">${kicker}</td>
        <td align="right" style="font-size:11px;color:#80868b;">${meta || ''}</td>
      </tr></table>
      <div style="height:1px;background:#e8eaed;margin-top:12px;"></div></td></tr>`;
}

export function digestHtml({ news = [], blogs = [], paper = null, dateStr, email, unsubUrl, issueDate, sponsorHtml }) {
  const unsub = unsubUrl || ('https://promptai.in/unsubscribe?email=' + encodeURIComponent(email || ''));
  const webUrl = issueDate ? ('https://promptai.in/issue/' + issueDate) : 'https://promptai.in';

  // Top story drives the hero; the rest fill the news list.
  const hero = news[0] || blogs[0] || null;
  const newsList = news[0] ? news.slice(1) : news;

  // Gmail/Outlook-safe STACKED hero: a real <img> on top (renders everywhere),
  // headline in a clean white block beneath — matches the briefing site's lead
  // card. When the top story has no image we drop in a branded gradient band
  // with a solid bgcolor fallback (Outlook ignores CSS gradients).
  const heroImage = hero && hero.img
    ? `<a href="${esc(hero.link)}" style="text-decoration:none;"><img src="${esc(hero.img)}" width="600" alt="" style="display:block;width:100%;max-width:600px;height:auto;border:0;outline:0;" /></a>`
    : `<table role="presentation" width="100%" cellpadding="0" cellspacing="0" bgcolor="#1a73e8" style="background:#1a73e8;background-image:linear-gradient(135deg,#1a73e8 0%,#174ea6 100%);"><tr><td height="190" style="height:190px;text-align:center;vertical-align:middle;font-family:Georgia,serif;font-size:40px;color:rgba(255,255,255,0.6);">◆</td></tr></table>`;

  const heroBlock = hero ? `
    <tr><td style="padding:0;font-size:0;line-height:0;" bgcolor="#f1f3f4">${heroImage}</td></tr>
    <tr><td style="padding:24px 36px 4px;font-family:Helvetica,Arial,sans-serif;" bgcolor="#ffffff">
      <div style="display:inline-block;background:#e8f0fe;color:#1967d2;font-size:10px;font-weight:bold;letter-spacing:1.6px;text-transform:uppercase;padding:6px 11px;border-radius:6px;">★ Today's top story</div>
      <a href="${esc(hero.link)}" style="text-decoration:none;"><div style="font-family:Georgia,serif;font-size:26px;line-height:1.22;color:#202124;margin:14px 0 8px;font-weight:bold;">${esc(hero.title)}</div></a>
      <div style="font-size:13.5px;line-height:1.6;color:#5f6368;">${esc(hero.desc)}</div>
      <div style="margin-top:16px;">
        <a href="${esc(hero.link)}" style="font-family:Helvetica,Arial,sans-serif;font-size:13px;font-weight:bold;color:#ffffff;text-decoration:none;background:#1a73e8;padding:11px 20px;border-radius:8px;display:inline-block;">Read the breakdown →</a>
        <span style="font-size:11px;color:#80868b;margin-left:12px;">${esc(hero.src)}</span>
      </div>
    </td></tr>` : '';

  const newsRows = newsList.map((b, i) => itemRow(b, i)).join('');
  const blogRows = blogs.map((b, i) => itemRow(b, i)).join('');

  const paperBlock = paper ? `
    <tr><td style="padding:30px 36px 6px;font-family:Helvetica,Arial,sans-serif;">
      <div style="font-size:11px;font-weight:bold;letter-spacing:2px;text-transform:uppercase;color:#1a73e8;">📄 &nbsp;Research Paper of the Day</div></td></tr>
    <tr><td style="padding:8px 36px 4px;">
      <table role="presentation" width="100%" cellpadding="0" cellspacing="0" bgcolor="#e8f0fe" style="background:#e8f0fe;border:1px solid #d2e3fc;border-radius:14px;">
        <tr><td style="padding:22px 24px;font-family:Helvetica,Arial,sans-serif;">
          <div style="font-size:10px;letter-spacing:1.5px;text-transform:uppercase;color:#1967d2;font-weight:bold;margin-bottom:8px;">${esc(paper.src || 'arXiv')}</div>
          <a href="${esc(paper.link)}" style="text-decoration:none;"><div style="font-family:Georgia,serif;font-size:19px;line-height:1.3;color:#202124;margin-bottom:8px;">${esc(paper.title)}</div></a>
          <div style="font-size:13.5px;line-height:1.6;color:#5f6368;margin-bottom:14px;">${esc(paper.desc)}</div>
          <a href="${esc(paper.link)}" style="font-size:13px;font-weight:bold;color:#1a73e8;text-decoration:none;">Read the paper →</a>
        </td></tr>
      </table></td></tr>` : '';

  return `<!DOCTYPE html><html lang="en"><head><meta charset="UTF-8"/><meta name="viewport" content="width=device-width, initial-scale=1.0"/><meta name="x-apple-disable-message-reformatting"/><!--[if mso]><style>* { font-family: Helvetica, Arial, sans-serif !important; }</style><![endif]--></head>
  <body style="margin:0;padding:0;background:#f1f3f4;-webkit-text-size-adjust:100%;">
  <div style="display:none;max-height:0;overflow:hidden;opacity:0;color:transparent;height:0;width:0;">Today in AI — the one story that matters, 5 headlines, 5 reads and the paper everyone's citing.</div>
  <table role="presentation" width="100%" cellpadding="0" cellspacing="0" style="background:#f1f3f4;"><tr><td align="center" style="padding:28px 14px;">
  <table role="presentation" width="600" cellpadding="0" cellspacing="0" style="width:600px;max-width:600px;background:#ffffff;border-radius:18px;overflow:hidden;border:1px solid #e8eaed;">

    <tr><td style="padding:22px 36px;border-bottom:1px solid #e8eaed;" bgcolor="#ffffff">
      <table role="presentation" width="100%" cellpadding="0" cellspacing="0"><tr>
        <td style="font-family:Georgia,serif;font-size:19px;font-weight:bold;color:#202124;"><span style="display:inline-block;width:9px;height:9px;background:#1a73e8;border-radius:50%;margin-right:9px;vertical-align:middle;"></span>Prompt<span style="color:#1a73e8;">AI</span></td>
        <td align="right" style="font-family:Helvetica,Arial,sans-serif;font-size:10px;letter-spacing:1.8px;text-transform:uppercase;color:#80868b;">The Briefing · ${esc(dateStr) || ''}</td>
      </tr></table></td></tr>

    ${heroBlock}
    ${sponsorHtml ? `<tr><td style="padding:18px 36px 0;">${sponsorHtml}</td></tr>` : ''}
    ${newsRows ? sectionHeader('📰 &nbsp;Top AI News', `${newsList.length} stories`) + newsRows : ''}
    ${blogRows ? sectionHeader('✍️ &nbsp;Blogs &amp; Deep Dives', 'Hand-picked') + blogRows : ''}
    ${paperBlock}

    <tr><td align="center" style="padding:30px 36px 6px;">
      <table role="presentation" cellpadding="0" cellspacing="0"><tr><td style="background:#1a73e8;border-radius:10px;">
        <a href="https://promptai.in" style="display:inline-block;padding:15px 32px;font-family:Helvetica,Arial,sans-serif;font-size:14px;font-weight:bold;color:#ffffff;text-decoration:none;">Open the live feed →</a>
      </td></tr></table></td></tr>
    <tr><td align="center" style="padding:12px 36px 4px;font-family:Helvetica,Arial,sans-serif;font-size:12px;color:#80868b;">The site updates daily. This briefing lands every Tuesday.</td></tr>

    <tr><td align="center" style="padding:18px 36px 0;font-family:Helvetica,Arial,sans-serif;font-size:12.5px;line-height:1.7;color:#5f6368;">
      📨 <strong>Forwarded this email?</strong> <a href="https://promptai.in/#newsletter" style="color:#1a73e8;text-decoration:none;font-weight:bold;">Get your own copy free →</a><br/>
      Found it useful? <a href="https://twitter.com/intent/tweet?url=${encodeURIComponent(webUrl)}&text=${encodeURIComponent("Today's AI briefing from @promptai_in")}" style="color:#1a73e8;text-decoration:none;font-weight:bold;">Share it on 𝕏</a> &nbsp;·&nbsp; <a href="${esc(webUrl)}" style="color:#1a73e8;text-decoration:none;font-weight:bold;">Read this issue on the web</a></td></tr>

    <tr><td align="center" style="padding:18px 36px 0;font-family:Helvetica,Arial,sans-serif;font-size:12px;color:#5f6368;">
      <a href="https://promptai.in/#news" style="color:#1a73e8;text-decoration:none;font-weight:bold;">News</a> &nbsp;·&nbsp;
      <a href="https://promptai.in/#research" style="color:#1a73e8;text-decoration:none;font-weight:bold;">Research</a> &nbsp;·&nbsp;
      <a href="https://promptai.in/education.html" style="color:#1a73e8;text-decoration:none;font-weight:bold;">Learn AI</a> &nbsp;·&nbsp;
      <a href="https://promptai.in/archive.html" style="color:#1a73e8;text-decoration:none;font-weight:bold;">Archive</a></td></tr>

    <tr><td style="padding:26px 36px 30px;border-top:1px solid #e8eaed;font-family:Helvetica,Arial,sans-serif;font-size:12px;line-height:1.7;color:#80868b;text-align:center;">
      <div style="font-family:Georgia,serif;font-size:15px;color:#202124;margin-bottom:6px;">PromptAI</div>
      You're getting this because you subscribed at promptai.in.<br/>
      <a href="${unsub}" style="color:#1a73e8;text-decoration:underline;">Unsubscribe</a> &nbsp;·&nbsp; <a href="${esc(webUrl)}" style="color:#1a73e8;text-decoration:underline;">Read on the web</a></td></tr>

  </table>
  <div style="font-family:Helvetica,Arial,sans-serif;font-size:11px;color:#9aa0a6;padding:16px 0 0;">© 2026 PromptAI · promptai.in</div>
  </td></tr></table>${email ? `<img src="https://promptai.in/e/open?e=${encodeURIComponent(email)}" width="1" height="1" alt="" style="display:block;width:1px;height:1px;border:0;opacity:0;overflow:hidden;" />` : ''}</body></html>`;
}

// ── plain-text alternative ───────────────────────────────────────────
// A readable text/plain version of the briefing. Sent alongside the HTML so
// spam filters see a multipart message (HTML-only mail is penalised) and
// text-only / accessibility clients still get the full content.
export function digestText({ news = [], blogs = [], paper = null, dateStr, email, unsubUrl, issueDate }) {
  const unsub = unsubUrl || ('https://promptai.in/unsubscribe?email=' + encodeURIComponent(email || ''));
  const webUrl = issueDate ? ('https://promptai.in/issue/' + issueDate) : 'https://promptai.in';
  const hero = news[0] || blogs[0] || null;
  const newsList = news[0] ? news.slice(1) : news;
  const lines = [];
  lines.push('PROMPTAI — THE BRIEFING' + (dateStr ? ' \u00b7 ' + dateStr : ''));
  lines.push('====================================');
  lines.push('');
  if (hero) {
    lines.push("TODAY'S TOP STORY");
    lines.push(hero.title);
    if (hero.desc) lines.push(hero.desc);
    lines.push(hero.link + (hero.src ? '  (' + hero.src + ')' : ''));
    lines.push('');
  }
  const block = (label, items) => {
    if (!items || !items.length) return;
    lines.push(label);
    lines.push('------------------------------------');
    items.forEach((b) => {
      lines.push('* ' + b.title + (b.src ? '  (' + b.src + ')' : ''));
      lines.push('  ' + b.link);
    });
    lines.push('');
  };
  block('TOP AI NEWS', newsList);
  block('BLOGS & DEEP DIVES', blogs);
  if (paper) {
    lines.push('RESEARCH PAPER OF THE DAY');
    lines.push('------------------------------------');
    lines.push(paper.title + (paper.src ? '  (' + paper.src + ')' : ''));
    if (paper.desc) lines.push(paper.desc);
    lines.push(paper.link);
    lines.push('');
  }
  lines.push('Open the live feed: https://promptai.in');
  lines.push('Read this issue on the web: ' + webUrl);
  lines.push('Forwarded this? Get your own copy: https://promptai.in/#newsletter');
  lines.push('');
  lines.push("You're getting this because you subscribed at promptai.in.");
  lines.push('Unsubscribe: ' + unsub);
  return lines.join('\n');
}

// Back-compat alias for older imports.
export const blogDigestHtml = ({ blogs, dateStr, email }) => digestHtml({ blogs, dateStr, email });

function json(obj, status = 200) {
  return new Response(JSON.stringify(obj, null, 2), {
    status,
    headers: { 'Content-Type': 'application/json', 'Access-Control-Allow-Origin': '*' },
  });
}
