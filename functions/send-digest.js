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
  // Never treat rate-limit bookkeeping keys ("rl:<ip>") as subscribers.
  emails = emails.filter(e => e && !e.startsWith('rl:'));
  if (emails.length === 0) return json({ sent: 0, message: 'No subscribers yet' });

  // ── send via Resend BATCH (≤100 personalized emails per request) ──
  // One HTTP request per 100 recipients keeps us under Resend's "2 requests/sec"
  // limit (the per-email loop tripped a 429). A short pause between batches
  // covers the case of >200 subscribers.
  const sleep = (ms) => new Promise((r) => setTimeout(r, ms));
  let sent = 0;
  let lastResendError = null;
  for (let i = 0; i < emails.length; i += 100) {
    const chunk = emails.slice(i, i + 100);
    const batch = chunk.map((email) => {
      const unsub = 'https://promptai.in/unsubscribe?email=' + encodeURIComponent(email);
      return {
        from: env.FROM_EMAIL,
        to: [email],
        subject,
        html: digestHtml({ ...content, dateStr, email }),
        // Plain-text alternative — HTML-only mail scores worse with spam filters.
        text: digestText({ ...content, dateStr, email }),
        // One-click unsubscribe — now required by Gmail/Yahoo for bulk senders and
        // a meaningful inbox-placement signal.
        headers: {
          'List-Unsubscribe': '<' + unsub + '>',
          'List-Unsubscribe-Post': 'List-Unsubscribe=One-Click',
        },
      };
    });
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

  return json({ success: true, recipients: emails.length, sent, subject, lastResendError,
    counts: { news: content.news.length, blogs: content.blogs.length, paper: content.paper ? 1 : 0 } });
  } catch (err) {
    return json({ error: 'send-digest crashed', detail: String(err && err.message || err) }, 200);
  }
}

// ── feed fetch ───────────────────────────────────────────────────────
// A Cloudflare Function can fetch RSS DIRECTLY (no browser CORS), so we parse
// the XML ourselves. rss2json is only a last-resort fallback because its free
// tier rate-limits datacenter IPs (which made every feed come back empty).
async function fetchFeedItems(feed, take) {
  const direct = await fetchDirect(feed, take);
  if (direct.length) return direct;
  return fetchViaRss2json(feed, take);
}

// 1) Direct fetch + lightweight XML parse (RSS <item> and Atom <entry>).
async function fetchDirect(feed, take) {
  const ac = new AbortController();
  const t = setTimeout(() => ac.abort(), 7000);
  try {
    const r = await fetch(feed, {
      signal: ac.signal,
      headers: {
        'User-Agent': 'Mozilla/5.0 (compatible; PromptAI/1.0; +https://promptai.in)',
        'Accept': 'application/rss+xml, application/atom+xml, application/xml, text/xml, */*',
      },
    });
    if (!r.ok) return [];
    const xml = await r.text();
    if (!xml || xml.length < 100) return [];
    const header = xml.split(/<item[\s>]/i)[0] || xml;
    const src = (decodeEntities(tagText(header, 'title')) || domainOf(feed)).replace(/\s*[-–|].*$/, '').trim();
    return parseFeed(xml, take).map(i => ({ ...i, src }));
  } catch (e) { return []; }
  finally { clearTimeout(t); }
}

// 2) Fallback proxy (kept for feeds that block direct datacenter requests).
async function fetchViaRss2json(feed, take) {
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
        img: cleanImg(item.thumbnail || item.enclosure?.link || firstImgIn(item.content || item.description || '')),
        src,
        date: item.pubDate ? new Date(item.pubDate) : new Date(0),
      }));
    }
  } catch (e) { /* ignore */ }
  finally { clearTimeout(t); }
  return [];
}

// ── tiny XML helpers (no DOMParser in Workers) ───────────────────────
function tagText(block, name) {
  const m = block.match(new RegExp('<' + name + '[^>]*>([\\s\\S]*?)<\\/' + name + '>', 'i'));
  return m ? m[1] : '';
}
function decodeEntities(s) {
  return (s || '')
    .replace(/<!\[CDATA\[([\s\S]*?)\]\]>/g, '$1')
    .replace(/<[^>]+>/g, ' ')
    .replace(/&amp;/g, '&').replace(/&lt;/g, '<').replace(/&gt;/g, '>')
    .replace(/&quot;/g, '"').replace(/&#0*39;|&apos;/g, "'")
    .replace(/&#(\d+);/g, (_, n) => String.fromCharCode(+n))
    .replace(/&#x([0-9a-f]+);/gi, (_, n) => String.fromCharCode(parseInt(n, 16)))
    .replace(/\s+/g, ' ').trim();
}

// ── image extraction ─────────────────────────────────────────────────
// Pull the best image URL from a raw RSS <item>/<entry> block. RSS feeds
// stash images in a half-dozen different places, so we try them in order of
// reliability and fall back to "" (the email then renders a gradient poster).
function pickImage(block) {
  if (!block) return '';
  const cands = [];
  let m;
  // media:content / media:thumbnail url="..."
  const mediaRe = /<media:(?:content|thumbnail)\b[^>]*\burl=["']([^"']+)["']/gi;
  while ((m = mediaRe.exec(block))) cands.push(m[1]);
  // <enclosure url="..." type="image/..."> (or url that looks like an image)
  const encRe = /<enclosure\b[^>]*>/gi;
  while ((m = encRe.exec(block))) {
    const tag = m[0];
    const um = tag.match(/\burl=["']([^"']+)["']/i);
    if (um && (/type=["']image\//i.test(tag) || isImgUrl(um[1]))) cands.push(um[1]);
  }
  // <itunes:image href="..."> and <image><url>...</url></image>
  m = block.match(/<itunes:image\b[^>]*\bhref=["']([^"']+)["']/i); if (m) cands.push(m[1]);
  m = block.match(/<image\b[^>]*>[\s\S]*?<url>([\s\S]*?)<\/url>/i);  if (m) cands.push(m[1]);
  // first <img src="..."> anywhere (content:encoded / description CDATA)
  const imgRe = /<img\b[^>]*\bsrc=["']([^"']+)["']/gi;
  while ((m = imgRe.exec(block))) cands.push(m[1]);
  for (const c of cands) {
    const u = cleanImg(c);
    if (u) return u;
  }
  return '';
}
function cleanImg(u) {
  if (!u) return '';
  u = decodeEntities(String(u)).trim();
  if (u.startsWith('//')) u = 'https:' + u;
  if (!/^https?:\/\//i.test(u)) return '';
  // Skip tracking pixels, spacers, avatars and tiny/animated junk.
  if (/feedburner|doubleclick|googlesyndication|\/pixel|1x1|spacer|gravatar|\.svg(\?|$)/i.test(u)) return '';
  return u;
}
function isImgUrl(u) { return /\.(jpe?g|png|webp|avif|gif)(\?|$)/i.test(u || ''); }
function firstImgIn(html) {
  const m = (html || '').match(/<img\b[^>]*\bsrc=["']([^"']+)["']/i);
  return m ? m[1] : '';
}

function parseFeed(xml, take) {
  const isRss = /<item[\s>]/i.test(xml);
  const chunks = xml.split(isRss ? /<item[\s>]/i : /<entry[\s>]/i).slice(1);
  const out = [];
  for (const block of chunks) {
    const title = decodeEntities(tagText(block, 'title'));
    let link = decodeEntities(tagText(block, 'link'));
    if (!link || /^https?:/.test(link) === false) {
      const lm = block.match(/<link[^>]*href=["']([^"']+)["']/i);
      if (lm) link = lm[1];
    }
    const descRaw = tagText(block, 'description') || tagText(block, 'summary') || tagText(block, 'content');
    const desc = truncate(decodeEntities(descRaw), 160);
    const img = pickImage(block);
    const dt = tagText(block, 'pubDate') || tagText(block, 'published') || tagText(block, 'updated') || tagText(block, 'dc:date');
    if (title && link) out.push({ title, link, desc, img, date: dt ? new Date(dt) : new Date(0) });
    if (out.length >= take) break;
  }
  return out;
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

export function digestHtml({ news = [], blogs = [], paper = null, dateStr, email }) {
  const unsub = 'https://promptai.in/unsubscribe?email=' + encodeURIComponent(email || '');

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
    ${newsRows ? sectionHeader('📰 &nbsp;Top AI News', `${newsList.length} stories`) + newsRows : ''}
    ${blogRows ? sectionHeader('✍️ &nbsp;Blogs &amp; Deep Dives', 'Hand-picked') + blogRows : ''}
    ${paperBlock}

    <tr><td align="center" style="padding:30px 36px 6px;">
      <table role="presentation" cellpadding="0" cellspacing="0"><tr><td style="background:#1a73e8;border-radius:10px;">
        <a href="https://promptai.in" style="display:inline-block;padding:15px 32px;font-family:Helvetica,Arial,sans-serif;font-size:14px;font-weight:bold;color:#ffffff;text-decoration:none;">Open the live feed →</a>
      </td></tr></table></td></tr>
    <tr><td align="center" style="padding:12px 36px 4px;font-family:Helvetica,Arial,sans-serif;font-size:12px;color:#80868b;">The site updates daily. This briefing lands every Tuesday.</td></tr>

    <tr><td align="center" style="padding:18px 36px 0;font-family:Helvetica,Arial,sans-serif;font-size:12px;color:#5f6368;">
      <a href="https://promptai.in/#news" style="color:#1a73e8;text-decoration:none;font-weight:bold;">News</a> &nbsp;·&nbsp;
      <a href="https://promptai.in/#research" style="color:#1a73e8;text-decoration:none;font-weight:bold;">Research</a> &nbsp;·&nbsp;
      <a href="https://promptai.in/education.html" style="color:#1a73e8;text-decoration:none;font-weight:bold;">Learn AI</a> &nbsp;·&nbsp;
      <a href="https://promptai.in/archive.html" style="color:#1a73e8;text-decoration:none;font-weight:bold;">Archive</a></td></tr>

    <tr><td style="padding:26px 36px 30px;border-top:1px solid #e8eaed;font-family:Helvetica,Arial,sans-serif;font-size:12px;line-height:1.7;color:#80868b;text-align:center;">
      <div style="font-family:Georgia,serif;font-size:15px;color:#202124;margin-bottom:6px;">PromptAI</div>
      You're getting this because you subscribed at promptai.in.<br/>
      <a href="${unsub}" style="color:#1a73e8;text-decoration:underline;">Unsubscribe</a> &nbsp;·&nbsp; <a href="https://promptai.in" style="color:#1a73e8;text-decoration:underline;">Read on the web</a></td></tr>

  </table>
  <div style="font-family:Helvetica,Arial,sans-serif;font-size:11px;color:#9aa0a6;padding:16px 0 0;">© 2026 PromptAI · promptai.in</div>
  </td></tr></table></body></html>`;
}

// ── plain-text alternative ───────────────────────────────────────────
// A readable text/plain version of the briefing. Sent alongside the HTML so
// spam filters see a multipart message (HTML-only mail is penalised) and
// text-only / accessibility clients still get the full content.
export function digestText({ news = [], blogs = [], paper = null, dateStr, email }) {
  const unsub = 'https://promptai.in/unsubscribe?email=' + encodeURIComponent(email || '');
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
  lines.push('');
  lines.push("You're getting this because you subscribed at promptai.in.");
  lines.push('Unsubscribe: ' + unsub);
  return lines.join('\n');
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
