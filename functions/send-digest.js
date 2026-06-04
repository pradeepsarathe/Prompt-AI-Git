// functions/send-digest.js
// Cloudflare Pages Function — builds the weekly digest from the LIVE feed and
// emails it to every subscriber in KV via Resend.
//
// Trigger it on a schedule (it is NOT public — requires the secret):
//   POST/GET  https://promptai.in/send-digest?key=YOUR_CRON_SECRET
//
// Because Pages Functions have no built-in cron, schedule the call with any of:
//   • a Cloudflare Worker with a Cron Trigger that fetch()es this URL, or
//   • a free scheduler (cron-job.org / GitHub Actions) hitting the URL weekly.
//
// Required bindings / vars (Pages → Settings → Functions):
//   KV binding   SUBSCRIBERS
//   Secret       RESEND_API_KEY     (from resend.com)
//   Variable     FROM_EMAIL         e.g.  PromptAI <weekly@promptai.in>
//   Secret       CRON_SECRET        any long random string

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
  if (!env.SUBSCRIBERS) {
    return json({ error: 'No SUBSCRIBERS KV binding' }, 503);
  }

  // ── 1. gather content from the live feed ──
  const { topStory, papers, headlines } = await gatherContent();
  if (!topStory && papers.length === 0 && headlines.length === 0) {
    return json({ error: 'No content available right now' }, 502);
  }

  // ── 2. list all subscribers ──
  const emails = [];
  let cursor;
  do {
    const page = await env.SUBSCRIBERS.list({ cursor, limit: 1000 });
    page.keys.forEach(k => emails.push(k.name));
    cursor = page.list_complete ? null : page.cursor;
  } while (cursor);

  if (emails.length === 0) return json({ sent: 0, message: 'No subscribers yet' });

  const dateStr = new Date().toLocaleDateString('en-US', { month: 'short', day: 'numeric', year: 'numeric' });
  const subject = topStory ? `PromptAI Weekly · ${truncate(topStory.title, 60)}` : `PromptAI Weekly · ${dateStr}`;

  // ── 3. send via Resend batch (≤100 per request) ──
  let sent = 0;
  for (let i = 0; i < emails.length; i += 100) {
    const batch = emails.slice(i, i + 100).map(email => ({
      from: env.FROM_EMAIL,
      to: [email],
      subject,
      html: digestHtml({ topStory, papers, headlines, dateStr, email }),
    }));
    try {
      const r = await fetch('https://api.resend.com/emails/batch', {
        method: 'POST',
        headers: { 'Authorization': 'Bearer ' + env.RESEND_API_KEY, 'Content-Type': 'application/json' },
        body: JSON.stringify(batch),
      });
      if (r.ok) sent += batch.length;
    } catch (e) { /* continue with next batch */ }
  }

  return json({ success: true, subscribers: emails.length, sent, subject });
}

// ── content aggregation (mirrors functions/feed.js sources) ──────────
async function gatherContent() {
  const aiKw = /\b(AI|LLM|GPT|claude|gemini|llama|transformer|machine learning|deep learning|neural|openai|anthropic|mistral|diffusion|RAG|agent|reasoning|inference)\b/i;
  const news = [];
  const papers = [];

  // Hacker News top AI stories
  try {
    const ids = (await (await fetch('https://hacker-news.firebaseio.com/v0/topstories.json',
      { signal: AbortSignal.timeout(6000) })).json()).slice(0, 40);
    const stories = await Promise.all(ids.map(id =>
      fetch(`https://hacker-news.firebaseio.com/v0/item/${id}.json`, { signal: AbortSignal.timeout(4000) })
        .then(r => r.json()).catch(() => null)));
    stories.filter(s => s && s.title && aiKw.test(s.title))
      .sort((a, b) => (b.score || 0) - (a.score || 0))
      .slice(0, 6)
      .forEach(s => news.push({
        title: s.title,
        link: s.url || `https://news.ycombinator.com/item?id=${s.id}`,
        meta: `${s.score || 0} pts · Hacker News`,
      }));
  } catch (e) { /* silent */ }

  // arXiv papers
  try {
    const r = await fetch('https://api.rss2json.com/v1/api.json?rss_url=' +
      encodeURIComponent('https://rss.arxiv.org/rss/cs.AI+cs.LG+cs.CL'), { signal: AbortSignal.timeout(8000) });
    const data = await r.json();
    if (data.status === 'ok') {
      data.items.slice(0, 3).forEach(item => papers.push({
        title: (item.title || '').replace(/\[.*?\]/g, '').trim(),
        link: item.link || item.guid || '',
        desc: truncate((item.description || '').replace(/<[^>]+>/g, '').trim(), 150),
        cat: 'arXiv',
      }));
    }
  } catch (e) { /* silent */ }

  const topStory = news.shift() || null;
  return { topStory, papers, headlines: news.slice(0, 4) };
}

// ── digest email HTML (mirrors emails/weekly-digest.html) ────────────
function digestHtml({ topStory, papers, headlines, dateStr, email }) {
  const unsub = 'https://promptai.in/unsubscribe?email=' + encodeURIComponent(email);
  const esc = s => (s || '').replace(/&/g, '&amp;').replace(/</g, '&lt;').replace(/>/g, '&gt;');

  const topBlock = topStory ? `
    <tr><td style="padding:24px 40px 4px;font-family:Helvetica,Arial,sans-serif;font-size:11px;font-weight:bold;letter-spacing:1.5px;text-transform:uppercase;color:#2563eb;">⭐ Top Story</td></tr>
    <tr><td style="padding:8px 40px;">
      <table role="presentation" width="100%" style="background:#f8fafc;border:1px solid #e2e8f0;border-radius:12px;"><tr><td style="padding:22px 24px;font-family:Helvetica,Arial,sans-serif;">
        <a href="${esc(topStory.link)}" style="text-decoration:none;"><div style="font-family:Georgia,serif;font-size:20px;line-height:1.3;color:#0a1628;margin-bottom:8px;">${esc(topStory.title)}</div></a>
        <div style="font-size:13px;color:#94a3b8;margin-bottom:12px;">${esc(topStory.meta)}</div>
        <a href="${esc(topStory.link)}" style="font-size:13px;font-weight:bold;color:#2563eb;text-decoration:none;">Read it →</a>
      </td></tr></table></td></tr>` : '';

  const paperRows = papers.map((p, i) => `
    <tr><td style="padding:14px 40px 0;"><table role="presentation" width="100%"><tr>
      <td valign="top" width="30" style="font-family:Georgia,serif;font-size:16px;color:#cbd5e1;">${String(i + 1).padStart(2, '0')}</td>
      <td valign="top" style="font-family:Helvetica,Arial,sans-serif;padding-left:6px;">
        <a href="${esc(p.link)}" style="text-decoration:none;"><div style="font-size:15px;font-weight:bold;line-height:1.4;color:#0a1628;">${esc(p.title)}</div></a>
        <div style="font-size:13px;line-height:1.6;color:#64748b;margin-top:3px;">${esc(p.desc)} <span style="color:#94a3b8;">· ${esc(p.cat)}</span></div>
      </td></tr></table></td></tr>`).join('');

  const paperBlock = papers.length ? `
    <tr><td style="padding:26px 40px 0;font-family:Helvetica,Arial,sans-serif;font-size:11px;font-weight:bold;letter-spacing:1.5px;text-transform:uppercase;color:#2563eb;">📄 Papers worth your time</td></tr>
    ${paperRows}` : '';

  const headlineItems = headlines.map(h =>
    `<div style="padding:5px 0;">→ <a href="${esc(h.link)}" style="color:#0a1628;text-decoration:none;font-weight:bold;">${esc(h.title)}</a> <span style="color:#94a3b8;">${esc(h.meta)}</span></div>`).join('');
  const headlineBlock = headlines.length ? `
    <tr><td style="padding:28px 40px 0;font-family:Helvetica,Arial,sans-serif;font-size:11px;font-weight:bold;letter-spacing:1.5px;text-transform:uppercase;color:#2563eb;">📰 Quick hits</td></tr>
    <tr><td style="padding:10px 40px 4px;font-family:Helvetica,Arial,sans-serif;font-size:14px;line-height:1.85;color:#475569;">${headlineItems}</td></tr>` : '';

  return `<!DOCTYPE html><html><body style="margin:0;padding:0;background:#eef2f7;">
  <table role="presentation" width="100%" style="background:#eef2f7;"><tr><td align="center" style="padding:32px 16px;">
  <table role="presentation" width="600" style="width:600px;max-width:600px;background:#fff;border-radius:16px;overflow:hidden;">
    <tr><td style="background:#0a1628;padding:26px 40px;">
      <table role="presentation" width="100%"><tr>
        <td style="font-family:Georgia,serif;font-size:20px;font-weight:bold;color:#fff;"><span style="display:inline-block;width:9px;height:9px;background:#2563eb;border-radius:50%;margin-right:8px;vertical-align:middle;"></span>PromptAI Weekly</td>
        <td align="right" style="font-family:Helvetica,Arial,sans-serif;font-size:11px;letter-spacing:1px;text-transform:uppercase;color:#64748b;">${dateStr}</td>
      </tr></table></td></tr>
    <tr><td style="padding:28px 40px 0;font-family:Helvetica,Arial,sans-serif;font-size:15px;line-height:1.7;color:#475569;">Good morning. Five minutes, the whole week in AI. ↓</td></tr>
    ${topBlock}
    ${paperBlock}
    ${headlineBlock}
    <tr><td style="background:#f8fafc;border-top:1px solid #e2e8f0;padding:26px 40px;margin-top:20px;font-family:Helvetica,Arial,sans-serif;font-size:12px;line-height:1.7;color:#94a3b8;text-align:center;">
      <div style="font-family:Georgia,serif;font-size:15px;color:#0a1628;margin-bottom:6px;">PromptAI Weekly</div>
      Curated AI research, papers &amp; news — every Tuesday.<br/>
      <a href="${unsub}" style="color:#2563eb;">Unsubscribe</a> · <a href="https://promptai.in" style="color:#2563eb;">Read on the web</a></td></tr>
  </table></td></tr></table></body></html>`;
}

function truncate(s, n) { s = s || ''; return s.length > n ? s.slice(0, n - 1).trim() + '…' : s; }
function json(obj, status = 200) {
  return new Response(JSON.stringify(obj, null, 2), {
    status,
    headers: { 'Content-Type': 'application/json', 'Access-Control-Allow-Origin': '*' },
  });
}
