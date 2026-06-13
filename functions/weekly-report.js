// functions/weekly-report.js
// Cloudflare Pages Function — emails YOU a weekly traffic & growth report.
//
// What it reports (last 7 days vs the 7 before):
//   • Visitors + article reads, day by day, with week-over-week deltas
//   • Subscribe funnel: modal opens → submits → successes
//   • Subscriber count (current)
//   • Top 10 most-read URLs
//   • Last digest-send health (meta:lastRun from SUBSCRIBERS KV)
//
// Schedule (cron-job.org or any scheduler) — every Monday ~08:00 IST:
//   GET https://promptai.in/weekly-report?key=YOUR_CRON_SECRET
// Optional: &to=someone@else.com to send a copy elsewhere this run.
//
// Required (already set up for send-digest):
//   KV binding   STATS          (visitor/read/event counters)
//   KV binding   SUBSCRIBERS    (subscriber list + meta:lastRun)
//   Secret       RESEND_API_KEY
//   Variable     FROM_EMAIL     e.g.  PromptAI <briefing@promptai.in>
//   Secret       CRON_SECRET
// New (one variable):
//   Variable     REPORT_EMAIL   where the report goes, e.g. you@gmail.com

const json = (obj, status = 200) =>
  new Response(JSON.stringify(obj), {
    status,
    headers: { 'Content-Type': 'application/json', 'Cache-Control': 'no-store' },
  });

const fmtDate = (d) => d.toISOString().slice(0, 10);
const pct = (now, prev) => {
  if (!prev) return now ? 'new' : '—';
  const p = Math.round(((now - prev) / prev) * 100);
  return (p >= 0 ? '+' : '') + p + '%';
};
const arrow = (now, prev) => (now > prev ? '▲' : now < prev ? '▼' : '—');

async function readNum(kv, key) {
  const raw = await kv.get(key);
  const n = parseInt(raw || '0', 10);
  return Number.isFinite(n) ? n : 0;
}

export async function onRequest(context) {
  const { request, env } = context;
  const url = new URL(request.url);

  // ── auth (same convention as send-digest) ──
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
  const to = (url.searchParams.get('to') || env.REPORT_EMAIL || '').trim();
  if (!to) return json({ error: 'No recipient: set REPORT_EMAIL variable or pass ?to=' }, 400);
  if (!env.STATS) return json({ error: 'STATS KV binding missing' }, 503);

  try {
    const kv = env.STATS;

    // ── day ranges: last 7 full days (incl. today) + the 7 before ──
    const days = [], prevDays = [];
    for (let i = 6; i >= 0; i--) {
      const d = new Date(Date.now() - i * 86400000);
      days.push(fmtDate(d));
    }
    for (let i = 13; i >= 7; i--) {
      const d = new Date(Date.now() - i * 86400000);
      prevDays.push(fmtDate(d));
    }

    const sumKeys = async (prefix, list) => {
      const vals = await Promise.all(list.map((d) => readNum(kv, prefix + d)));
      return { perDay: vals, total: vals.reduce((a, b) => a + b, 0) };
    };
    const sumEvents = async (name, list) => {
      const vals = await Promise.all(list.map((d) => readNum(kv, 'e:' + d + ':' + name)));
      return vals.reduce((a, b) => a + b, 0);
    };

    const [visits, visitsPrev, reads, readsPrev] = await Promise.all([
      sumKeys('v:day:', days), sumKeys('v:day:', prevDays),
      sumKeys('a:day:', days), sumKeys('a:day:', prevDays),
    ]);
    const [modalOpen, subSubmit, subSuccess, searchUsed] = await Promise.all([
      sumEvents('modal_open', days), sumEvents('subscribe_submit', days),
      sumEvents('subscribe_success', days), sumEvents('search_used', days),
    ]);
    const [vTotal, aTotal, popRaw] = await Promise.all([
      readNum(kv, 'v:total'), readNum(kv, 'a:total'), kv.get('popular'),
    ]);
    let popular = [];
    try {
      popular = Object.entries(JSON.parse(popRaw || '{}') || {})
        .sort((a, b) => b[1] - a[1]).slice(0, 10);
    } catch (e) { /* fine */ }

    // ── subscribers + last send health ──
    let subCount = 0, lastRun = null;
    if (env.SUBSCRIBERS) {
      let cursor;
      do {
        const page = await env.SUBSCRIBERS.list({ cursor, limit: 1000 });
        subCount += page.keys.filter((k) => k.name.includes('@')).length;
        cursor = page.list_complete ? null : page.cursor;
      } while (cursor);
      try { lastRun = JSON.parse(await env.SUBSCRIBERS.get('meta:lastRun') || 'null'); } catch (e) {}
    }

    // ── build the email ──
    const range = days[0] + ' → ' + days[6];
    const dayRows = days.map((d, i) =>
      `<tr><td style="padding:5px 12px;font-size:13px;color:#5f6368;">${d}</td>` +
      `<td align="right" style="padding:5px 12px;font-size:13px;"><b>${visits.perDay[i]}</b></td>` +
      `<td align="right" style="padding:5px 12px;font-size:13px;">${reads.perDay[i]}</td></tr>`
    ).join('');
    const popRows = popular.length
      ? popular.map(([u, n], i) =>
          `<tr><td style="padding:4px 12px;font-size:12.5px;color:#5f6368;">${i + 1}.</td>` +
          `<td style="padding:4px 12px;font-size:12.5px;word-break:break-all;"><a href="${u}" style="color:#1a73e8;text-decoration:none;">${u.replace('https://', '')}</a></td>` +
          `<td align="right" style="padding:4px 12px;font-size:12.5px;"><b>${n}</b></td></tr>`).join('')
      : '<tr><td style="padding:8px 12px;font-size:13px;color:#5f6368;">No read data yet.</td></tr>';
    const health = lastRun
      ? `Last digest: ${lastRun.at ? lastRun.at.slice(0, 16).replace('T', ' ') : '?'} — sent ${lastRun.sent}/${lastRun.recipients}` +
        (lastRun.lastResendError ? ` · <b style="color:#d93025;">Resend error: ${String(lastRun.lastResendError).slice(0, 120)}</b>` : ' · no errors')
      : 'No digest-send record found.';

    const stat = (label, now, prev) =>
      `<td width="33%" align="center" style="padding:14px 6px;background:#f3f6fc;border-radius:10px;">` +
      `<div style="font-size:26px;font-weight:bold;color:#202124;">${now}</div>` +
      `<div style="font-size:12px;color:#5f6368;margin-top:2px;">${label}</div>` +
      `<div style="font-size:12px;margin-top:4px;color:${now >= prev ? '#188038' : '#d93025'};">${arrow(now, prev)} ${pct(now, prev)} vs prior week</div></td>`;

    const html = `<!DOCTYPE html><html><body style="margin:0;padding:0;background:#f1f3f4;">
<table role="presentation" width="100%" cellpadding="0" cellspacing="0"><tr><td align="center" style="padding:24px 12px;">
<table role="presentation" width="600" cellpadding="0" cellspacing="0" style="max-width:600px;background:#ffffff;border-radius:14px;overflow:hidden;font-family:Helvetica,Arial,sans-serif;">
  <tr><td style="background:#1a73e8;padding:20px 28px;">
    <span style="color:#ffffff;font-size:18px;font-weight:bold;">PromptAI — weekly traffic report</span><br/>
    <span style="color:#d2e3fc;font-size:13px;">${range}</span>
  </td></tr>
  <tr><td style="padding:24px 28px 8px;">
    <table role="presentation" width="100%" cellpadding="0" cellspacing="6"><tr>
      ${stat('visitors', visits.total, visitsPrev.total)}
      ${stat('article reads', reads.total, readsPrev.total)}
      ${stat('subscribers (total)', subCount, subCount)}
    </tr></table>
  </td></tr>
  <tr><td style="padding:10px 28px;">
    <div style="font-size:14px;font-weight:bold;color:#202124;padding-bottom:6px;">Subscribe funnel (this week)</div>
    <div style="font-size:13px;color:#3c4043;line-height:1.8;">
      Modal opens: <b>${modalOpen}</b> → submits: <b>${subSubmit}</b> → confirmed: <b>${subSuccess}</b>
      ${subSubmit ? `· conversion ${Math.round((subSuccess / subSubmit) * 100)}%` : ''}<br/>
      Site search used: <b>${searchUsed}</b> times
    </div>
  </td></tr>
  <tr><td style="padding:10px 28px;">
    <div style="font-size:14px;font-weight:bold;color:#202124;padding-bottom:4px;">Day by day</div>
    <table role="presentation" width="100%" cellpadding="0" cellspacing="0" style="border:1px solid #e8eaed;border-radius:8px;">
      <tr style="background:#f8f9fa;"><td style="padding:6px 12px;font-size:12px;color:#5f6368;">date</td><td align="right" style="padding:6px 12px;font-size:12px;color:#5f6368;">visitors</td><td align="right" style="padding:6px 12px;font-size:12px;color:#5f6368;">reads</td></tr>
      ${dayRows}
    </table>
  </td></tr>
  <tr><td style="padding:10px 28px;">
    <div style="font-size:14px;font-weight:bold;color:#202124;padding-bottom:4px;">Most-read pages (last 30 days)</div>
    <table role="presentation" width="100%" cellpadding="0" cellspacing="0" style="border:1px solid #e8eaed;border-radius:8px;">${popRows}</table>
  </td></tr>
  <tr><td style="padding:10px 28px 4px;">
    <div style="font-size:13px;color:#5f6368;">${health}</div>
    <div style="font-size:13px;color:#5f6368;margin-top:4px;">All-time: <b>${vTotal}</b> visitors · <b>${aTotal}</b> reads</div>
  </td></tr>
  <tr><td style="padding:16px 28px 22px;">
    <div style="font-size:12px;color:#9aa0a6;">Deeper data: <a href="https://search.google.com/search-console" style="color:#1a73e8;text-decoration:none;">Search Console</a> · <a href="https://www.bing.com/webmasters" style="color:#1a73e8;text-decoration:none;">Bing</a> · generated automatically by /weekly-report</div>
  </td></tr>
</table>
</td></tr></table>
</body></html>`;

    const subject = `PromptAI week: ${visits.total} visitors (${pct(visits.total, visitsPrev.total)}), ${subCount} subscribers`;
    const r = await fetch('https://api.resend.com/emails', {
      method: 'POST',
      headers: { 'Authorization': 'Bearer ' + env.RESEND_API_KEY, 'Content-Type': 'application/json' },
      body: JSON.stringify({ from: env.FROM_EMAIL, to: [to], subject, html }),
    });
    if (!r.ok) return json({ error: 'Resend failed: ' + (await r.text()).slice(0, 300) }, 502);

    return json({ success: true, to, subject, visitors: visits.total, reads: reads.total, subscribers: subCount });
  } catch (err) {
    return json({ error: err.message }, 500);
  }
}
