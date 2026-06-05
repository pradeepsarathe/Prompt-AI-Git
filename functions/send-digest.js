// functions/send-digest.js
// Cloudflare Pages Function — builds a PromptAI briefing email
// (5 news + 5 blogs + 1 research paper) from live feeds and sends it via Resend.
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

// ── feed sources ─────────────────────────────────────────────────────
const NEWS_FEEDS = [
  'https://techcrunch.com/category/artificial-intelligence/feed/',
  'https://www.theverge.com/ai-artificial-intelligence/rss/index.xml',
  'https://venturebeat.com/category/ai/feed/',
  'https://feeds.arstechnica.com/arstechnica/technology-lab',
];
const BLOG_FEEDS = [
  'https://thegradient.pub/rss/',
  'https://huggingface.co/blog/feed.xml',
  'https://blog.research.google/feeds/posts/default',
  'https://www.deeplearning.ai/the-batch/feed/',
  'https://www.fast.ai/index.xml',
];
const PAPER_FEEDS = [
  'https://rss.arxiv.org/rss/cs.AI',
  'https://rss.arxiv.org/rss/cs.LG',
];

export async function onRequest(context) {
  const { request, env } = context;
  const url = new URL(request.url);

  // ── auth ──
  if (!env.CRON_SECRET || url.searchParams.get('key') !== env.CRON_SECRET) {
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
  if (emails.length === 0) return json({ sent: 0, message: 'No subscribers yet' });

  // ── send via Resend (one request per recipient; robust to a slow batch) ──
  let sent = 0;
  let lastResendError = null;
  for (const email of emails) {
    try {
      const r = await fetch('https://api.resend.com/emails', {
        method: 'POST',
        headers: { 'Authorization': 'Bearer ' + env.RESEND_API_KEY, 'Content-Type': 'application/json' },
        body: JSON.stringify({ from: env.FROM_EMAIL, to: [email], subject, html: digestHtml({ ...content, dateStr, email }) }),
      });
      if (r.ok) sent++;
      else lastResendError = (await r.text()).slice(0, 300);
    } catch (e) { lastResendError = e.message; }
  }

  return json({ success: true, recipients: emails.length, sent, subject, lastResendError,
    counts: { news: content.news.length, blogs: content.blogs.length, paper: content.paper ? 1 : 0 } });
  } catch (err) {
    return json({ error: 'send-digest crashed', detail: String(err && err.message || err) }, 200);
  }
}

// ── generic feed fetch via rss2json (dodges CORS / format issues) ─────
// Manual AbortController timeout (more portable than AbortSignal.timeout).
async function fetchFeedItems(feed, take) {
  const ac = new AbortController();
  const t = setTimeout(() => ac.abort(), 7000);
  try {
    const r = await fetch('https://api.rss2json.com/v1/api.json?rss_url=' + encodeURIComponent(feed),
      { signal: ac.signal });
    const data = await r.json();
    if (data.status === 'ok' && data.items?.length) {
      const src = (data.feed?.title || domainOf(feed)).replace(/\s*[-–|].*$/, '').trim();
      return data.items.slice(0, take).map(item => ({
        title: (item.title || '').trim(),
        link: item.link || item.guid || '',
        desc: truncate((item.description || item.content || '').replace(/<[^>]+>/g, '').trim(), 160),
        src,
        date: item.pubDate ? new Date(item.pubDate) : new Date(0),
      }));
    }
  } catch (e) { /* ignore */ }
  finally { clearTimeout(t); }
  return [];
}

// Resolve a promise but never wait longer than `ms` (returns `fallback`).
function withTimeout(promise, ms, fallback) {
  return Promise.race([
    promise,
    new Promise(res => setTimeout(() => res(fallback), ms)),
  ]);
}

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

function itemRow(b, i) {
  return `
    <tr><td style="padding:${i === 0 ? '4' : '14'}px 40px 0;">
      <table role="presentation" width="100%"><tr>
        <td valign="top" width="30" style="font-family:Georgia,serif;font-size:16px;color:#cbd5e1;">${String(i + 1).padStart(2, '0')}</td>
        <td valign="top" style="font-family:Helvetica,Arial,sans-serif;padding-left:6px;">
          <a href="${esc(b.link)}" style="text-decoration:none;"><div style="font-size:16px;font-weight:bold;line-height:1.35;color:#0a1628;">${esc(b.title)}</div></a>
          <div style="font-size:13px;line-height:1.6;color:#64748b;margin-top:4px;">${esc(b.desc)}</div>
          <div style="font-size:12px;color:#94a3b8;margin-top:5px;">${esc(b.src)} · <a href="${esc(b.link)}" style="color:#2563eb;text-decoration:none;font-weight:600;">Read →</a></div>
        </td>
      </tr></table>
    </td></tr>`;
}

function sectionHeader(kicker, title) {
  return `
    <tr><td style="padding:26px 40px 6px;font-family:Helvetica,Arial,sans-serif;">
      <div style="font-size:11px;font-weight:bold;letter-spacing:1.5px;text-transform:uppercase;color:#2563eb;">${kicker}</div>
      <h2 style="margin:6px 0 0;font-family:Georgia,serif;font-size:20px;line-height:1.25;color:#0a1628;font-weight:normal;">${title}</h2></td></tr>`;
}

function divider() {
  return `<tr><td style="padding:18px 40px 0;"><div style="border-top:1px solid #eef2f7;"></div></td></tr>`;
}

export function digestHtml({ news = [], blogs = [], paper = null, dateStr, email }) {
  const unsub = 'https://promptai.in/unsubscribe?email=' + encodeURIComponent(email || '');

  const newsRows  = news.map((b, i) => itemRow(b, i)).join('');
  const blogRows  = blogs.map((b, i) => itemRow(b, i)).join('');
  const paperBlock = paper ? `
    ${sectionHeader('📄 Research paper of the day', 'One paper worth your time')}
    ${itemRow(paper, 0)}` : '';

  return `<!DOCTYPE html><html><body style="margin:0;padding:0;background:#eef2f7;">
  <table role="presentation" width="100%" style="background:#eef2f7;"><tr><td align="center" style="padding:32px 16px;">
  <table role="presentation" width="600" style="width:600px;max-width:600px;background:#fff;border-radius:16px;overflow:hidden;">
    <tr><td style="background:#0a1628;padding:26px 40px;">
      <table role="presentation" width="100%"><tr>
        <td style="font-family:Georgia,serif;font-size:20px;font-weight:bold;color:#fff;"><span style="display:inline-block;width:9px;height:9px;background:#2563eb;border-radius:50%;margin-right:8px;vertical-align:middle;"></span>PromptAI</td>
        <td align="right" style="font-family:Helvetica,Arial,sans-serif;font-size:11px;letter-spacing:1px;text-transform:uppercase;color:#64748b;">${dateStr || ''}</td>
      </tr></table></td></tr>
    <tr><td style="padding:28px 40px 0;font-family:Helvetica,Arial,sans-serif;">
      <div style="font-size:11px;font-weight:bold;letter-spacing:1.5px;text-transform:uppercase;color:#2563eb;">Today's AI briefing</div>
      <h1 style="margin:8px 0 0;font-family:Georgia,serif;font-size:24px;line-height:1.25;color:#0a1628;font-weight:normal;">5 headlines, 5 reads, 1 paper</h1></td></tr>

    ${news.length ? sectionHeader('📰 Top AI news', 'What happened today') + newsRows : ''}
    ${blogs.length ? divider() + sectionHeader('✍️ Blogs &amp; deep dives', 'Hand-picked reads') + blogRows : ''}
    ${paper ? divider() + paperBlock : ''}

    <tr><td style="padding:30px 40px 0;"></td></tr>
    <tr><td style="background:#f8fafc;border-top:1px solid #e2e8f0;padding:24px 40px;font-family:Helvetica,Arial,sans-serif;font-size:12px;line-height:1.7;color:#94a3b8;text-align:center;">
      <div style="font-family:Georgia,serif;font-size:15px;color:#0a1628;margin-bottom:6px;">PromptAI</div>
      You're getting this because you subscribed at promptai.in.<br/>
      <a href="${unsub}" style="color:#2563eb;">Unsubscribe</a> · <a href="https://promptai.in" style="color:#2563eb;">Read on the web</a></td></tr>
  </table></td></tr></table></body></html>`;
}

// Back-compat alias for older imports.
export const blogDigestHtml = ({ blogs, dateStr, email }) => digestHtml({ blogs, dateStr, email });

function truncate(s, n) { s = s || ''; return s.length > n ? s.slice(0, n - 1).trim() + '…' : s; }
function domainOf(u) { try { return new URL(u).hostname.replace('www.', ''); } catch (e) { return u; } }
function json(obj, status = 200) {
  return new Response(JSON.stringify(obj, null, 2), {
    status,
    headers: { 'Content-Type': 'application/json', 'Access-Control-Allow-Origin': '*' },
  });
}
