// functions/send-digest.js
// Cloudflare Pages Function — builds a "Latest Blogs" email from live blog feeds
// and emails it to subscribers via Resend.
//
// Two ways it's used:
//   1. Recurring send to ALL subscribers (schedule this hourly while testing):
//        GET  https://promptai.in/send-digest?key=YOUR_CRON_SECRET
//   2. Single send to one new subscriber (called automatically by subscribe.js):
//        GET  https://promptai.in/send-digest?key=YOUR_CRON_SECRET&to=user@example.com
//
// Cloudflare Pages has no built-in cron — schedule #1 with a free scheduler
// (cron-job.org) or a Cloudflare Worker Cron Trigger hitting the URL every hour.
//
// Required (Pages → Settings → Functions):
//   KV binding   SUBSCRIBERS
//   Secret       RESEND_API_KEY     (from resend.com)
//   Variable     FROM_EMAIL         e.g.  PromptAI <blogs@promptai.in>
//   Secret       CRON_SECRET        any long random string

// Blog feeds the digest pulls from (pulled via rss2json to dodge CORS/format issues)
const BLOG_FEEDS = [
  'https://thegradient.pub/rss/',
  'https://huggingface.co/blog/feed.xml',
  'https://blog.research.google/feeds/posts/default',
  'https://www.deeplearning.ai/the-batch/feed/',
  'https://www.fast.ai/index.xml',
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

  // ── content: latest blogs ──
  const blogs = await fetchLatestBlogs();
  if (blogs.length === 0) return json({ error: 'No blog content available right now' }, 502);

  const dateStr = new Date().toLocaleString('en-US', {
    month: 'short', day: 'numeric', hour: 'numeric', minute: '2-digit',
  });
  const subject = `📚 Latest AI blogs · ${blogs[0].title.slice(0, 50)}`;

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

  // ── send via Resend batch (≤100 per request) ──
  let sent = 0;
  for (let i = 0; i < emails.length; i += 100) {
    const batch = emails.slice(i, i + 100).map(email => ({
      from: env.FROM_EMAIL,
      to: [email],
      subject,
      html: blogDigestHtml({ blogs, dateStr, email }),
    }));
    try {
      const r = await fetch('https://api.resend.com/emails/batch', {
        method: 'POST',
        headers: { 'Authorization': 'Bearer ' + env.RESEND_API_KEY, 'Content-Type': 'application/json' },
        body: JSON.stringify(batch),
      });
      if (r.ok) sent += batch.length;
    } catch (e) { /* continue */ }
  }

  return json({ success: true, recipients: emails.length, sent, subject });
}

// ── fetch + merge latest posts from the blog feeds ───────────────────
export async function fetchLatestBlogs() {
  const out = [];
  const settled = await Promise.allSettled(BLOG_FEEDS.map(async (feed) => {
    const r = await fetch('https://api.rss2json.com/v1/api.json?rss_url=' + encodeURIComponent(feed),
      { signal: AbortSignal.timeout(8000) });
    const data = await r.json();
    if (data.status === 'ok' && data.items?.length) {
      const src = (data.feed?.title || domainOf(feed)).replace(/\s*[-–|].*$/, '').trim();
      return data.items.slice(0, 4).map(item => ({
        title: (item.title || '').trim(),
        link: item.link || item.guid || '',
        desc: truncate((item.description || item.content || '').replace(/<[^>]+>/g, '').trim(), 160),
        src,
        date: item.pubDate ? new Date(item.pubDate) : new Date(0),
      }));
    }
    return [];
  }));
  settled.forEach(s => { if (s.status === 'fulfilled') out.push(...s.value); });

  // newest first, dedupe by link, cap at 8
  const seen = new Set();
  return out
    .filter(b => b.link && !seen.has(b.link) && seen.add(b.link))
    .sort((a, b) => b.date - a.date)
    .slice(0, 8);
}

// ── email HTML ───────────────────────────────────────────────────────
export function blogDigestHtml({ blogs, dateStr, email }) {
  const unsub = 'https://promptai.in/unsubscribe?email=' + encodeURIComponent(email || '');
  const esc = s => (s || '').replace(/&/g, '&amp;').replace(/</g, '&lt;').replace(/>/g, '&gt;');

  const rows = blogs.map((b, i) => `
    <tr><td style="padding:${i === 0 ? '4' : '16'}px 40px 0;">
      <table role="presentation" width="100%"><tr>
        <td valign="top" width="30" style="font-family:Georgia,serif;font-size:16px;color:#cbd5e1;">${String(i + 1).padStart(2, '0')}</td>
        <td valign="top" style="font-family:Helvetica,Arial,sans-serif;padding-left:6px;">
          <a href="${esc(b.link)}" style="text-decoration:none;"><div style="font-size:16px;font-weight:bold;line-height:1.35;color:#0a1628;">${esc(b.title)}</div></a>
          <div style="font-size:13px;line-height:1.6;color:#64748b;margin-top:4px;">${esc(b.desc)}</div>
          <div style="font-size:12px;color:#94a3b8;margin-top:5px;">${esc(b.src)} · <a href="${esc(b.link)}" style="color:#2563eb;text-decoration:none;font-weight:600;">Read →</a></div>
        </td>
      </tr></table>
      ${i < blogs.length - 1 ? '<div style="border-top:1px solid #f1f5f9;margin:14px 0 0;"></div>' : ''}
    </td></tr>`).join('');

  return `<!DOCTYPE html><html><body style="margin:0;padding:0;background:#eef2f7;">
  <table role="presentation" width="100%" style="background:#eef2f7;"><tr><td align="center" style="padding:32px 16px;">
  <table role="presentation" width="600" style="width:600px;max-width:600px;background:#fff;border-radius:16px;overflow:hidden;">
    <tr><td style="background:#0a1628;padding:26px 40px;">
      <table role="presentation" width="100%"><tr>
        <td style="font-family:Georgia,serif;font-size:20px;font-weight:bold;color:#fff;"><span style="display:inline-block;width:9px;height:9px;background:#2563eb;border-radius:50%;margin-right:8px;vertical-align:middle;"></span>PromptAI</td>
        <td align="right" style="font-family:Helvetica,Arial,sans-serif;font-size:11px;letter-spacing:1px;text-transform:uppercase;color:#64748b;">${dateStr}</td>
      </tr></table></td></tr>
    <tr><td style="padding:28px 40px 8px;font-family:Helvetica,Arial,sans-serif;">
      <div style="font-size:11px;font-weight:bold;letter-spacing:1.5px;text-transform:uppercase;color:#2563eb;">📚 Latest from the AI blogs</div>
      <h1 style="margin:8px 0 0;font-family:Georgia,serif;font-size:24px;line-height:1.25;color:#0a1628;font-weight:normal;">Fresh reads, hand-pulled from the best sources</h1></td></tr>
    ${rows}
    <tr><td style="padding:26px 40px 0;"></td></tr>
    <tr><td style="background:#f8fafc;border-top:1px solid #e2e8f0;padding:24px 40px;font-family:Helvetica,Arial,sans-serif;font-size:12px;line-height:1.7;color:#94a3b8;text-align:center;">
      <div style="font-family:Georgia,serif;font-size:15px;color:#0a1628;margin-bottom:6px;">PromptAI</div>
      You're getting this because you subscribed at promptai.in.<br/>
      <a href="${unsub}" style="color:#2563eb;">Unsubscribe</a> · <a href="https://promptai.in" style="color:#2563eb;">Read on the web</a></td></tr>
  </table></td></tr></table></body></html>`;
}

function truncate(s, n) { s = s || ''; return s.length > n ? s.slice(0, n - 1).trim() + '…' : s; }
function domainOf(u) { try { return new URL(u).hostname.replace('www.', ''); } catch (e) { return u; } }
function json(obj, status = 200) {
  return new Response(JSON.stringify(obj, null, 2), {
    status,
    headers: { 'Content-Type': 'application/json', 'Access-Control-Allow-Origin': '*' },
  });
}
