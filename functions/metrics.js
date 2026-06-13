// functions/metrics.js
// GET /metrics?key=CRON_SECRET  (or Authorization: Bearer CRON_SECRET)
// Authed funnel dashboard — reads the /api/event counters + CSP reports +
// the cron run-state breadcrumbs and renders a simple internal HTML view.
// Answers the review's "funnel measurement is pageview-level" gap: it shows
// conversion ratios, not just visits.  noindex; not linked anywhere public.

const EVENTS = [
  ['story_open', 'Story opened'],
  ['paper_explain', 'Paper explained'],
  ['subscribe_click', 'Subscribe clicked'],
  ['subscribe_success', 'Subscribe completed'],
  ['prompt_copy', 'Prompt copied'],
  ['share_click', 'Share clicked'],
  ['sample_click', 'Sample issue clicked'],
  ['push_click', 'Notif. enable clicked'],
];

const esc = (s) => String(s == null ? '' : s).replace(/&/g, '&amp;').replace(/</g, '&lt;').replace(/>/g, '&gt;');

export async function onRequest(context) {
  const { request, env } = context;
  const url = new URL(request.url);
  const authz = request.headers.get('Authorization') || '';
  const key = authz.startsWith('Bearer ') ? authz.slice(7).trim() : (url.searchParams.get('key') || '');
  if (!env.CRON_SECRET || key !== env.CRON_SECRET) {
    return new Response('Unauthorized', { status: 401, headers: { 'Content-Type': 'text/plain' } });
  }
  if (!env.STATS) return new Response('No STATS KV', { status: 503 });

  const days = parseInt(url.searchParams.get('days') || '14', 10);
  const dayList = [];
  for (let i = 0; i < days; i++) {
    dayList.push(new Date(Date.now() - i * 86400000).toISOString().slice(0, 10));
  }

  // totals[name] over the window + per-day for sparkline-ish table
  const totals = {};
  const byDay = {}; // day -> {name: n}
  await Promise.all(dayList.flatMap((day) => {
    byDay[day] = {};
    return EVENTS.map(async ([name]) => {
      const n = parseInt((await env.STATS.get('ev:' + day + ':' + name)) || '0', 10) || 0;
      totals[name] = (totals[name] || 0) + n;
      byDay[day][name] = n;
    });
  }));

  const pct = (a, b) => (b > 0 ? Math.round((a / b) * 1000) / 10 + '%' : '—');
  const t = (n) => totals[n] || 0;

  // run-state breadcrumbs
  const getMeta = async (k) => { try { return JSON.parse((await env.STATS.get(k)) || 'null'); } catch (e) { return null; } };
  const [feeds, welcome, winback, cspSamplesRaw] = await Promise.all([
    getMeta('meta:feedsLastRun'), getMeta('meta:lastWelcomeRun'), getMeta('meta:lastWinbackRun'),
    env.STATS.get('csp:samples'),
  ]);
  let cspSamples = [];
  try { cspSamples = JSON.parse(cspSamplesRaw || '[]'); } catch (e) {}

  const funnelRows = `
    <tr><td>Story opened</td><td class="n">${t('story_open')}</td><td>—</td></tr>
    <tr><td>→ Subscribe clicked</td><td class="n">${t('subscribe_click')}</td><td>${pct(t('subscribe_click'), t('story_open'))} of opens</td></tr>
    <tr><td>→ Subscribe completed</td><td class="n">${t('subscribe_success')}</td><td>${pct(t('subscribe_success'), t('subscribe_click'))} of clicks</td></tr>`;

  const eventRows = EVENTS.map(([name, label]) =>
    `<tr><td>${esc(label)}</td><td class="n">${t(name)}</td></tr>`).join('');

  const dayRows = dayList.map((d) =>
    `<tr><td>${d}</td>${EVENTS.map(([n]) => `<td class="n">${byDay[d][n] || 0}</td>`).join('')}</tr>`).join('');

  const cspRows = cspSamples.length
    ? cspSamples.map((s) => `<tr><td>${esc((s.at || '').slice(0, 16))}</td><td>${esc(s.directive)}</td><td class="mono">${esc(s.blocked)}</td></tr>`).join('')
    : '<tr><td colspan="3" style="color:#80868b">No CSP reports yet — either nothing violates the Report-Only policy, or it hasn\u2019t been deployed long.</td></tr>';

  const runLine = (m) => m ? `${esc((m.at || '').slice(0, 16))} · ${esc(JSON.stringify(m).slice(0, 180))}` : 'no run recorded';

  const html = `<!DOCTYPE html><html lang="en"><head>
<meta charset="UTF-8"/><meta name="viewport" content="width=device-width, initial-scale=1.0"/>
<meta name="robots" content="noindex,nofollow"/>
<title>PromptAI — funnel & ops</title>
<style>
  body{font-family:system-ui,-apple-system,Segoe UI,Roboto,sans-serif;background:#0f1115;color:#e8eaed;margin:0;padding:28px;line-height:1.5}
  h1{font-size:1.4rem;margin:0 0 4px} .sub{color:#9aa0a6;font-size:.85rem;margin-bottom:22px}
  h2{font-size:1rem;margin:30px 0 10px;color:#aecbfa}
  .cards{display:flex;gap:12px;flex-wrap:wrap;margin-bottom:8px}
  .card{background:#1a1d24;border:1px solid #2a2e37;border-radius:12px;padding:14px 18px;min-width:130px}
  .card .v{font-size:1.7rem;font-weight:700;color:#8ab4f8} .card .l{font-size:.72rem;color:#9aa0a6;text-transform:uppercase;letter-spacing:.05em}
  table{border-collapse:collapse;width:100%;font-size:.85rem;margin-bottom:6px;background:#1a1d24;border-radius:10px;overflow:hidden}
  th,td{text-align:left;padding:8px 12px;border-bottom:1px solid #23272f} th{color:#9aa0a6;font-size:.72rem;text-transform:uppercase;letter-spacing:.05em}
  td.n{text-align:right;font-variant-numeric:tabular-nums;font-weight:600} .mono{font-family:ui-monospace,Menlo,monospace;font-size:.78rem;color:#9aa0a6}
  .ops{background:#1a1d24;border:1px solid #2a2e37;border-radius:10px;padding:12px 16px;font-size:.8rem;color:#c4c7cc;font-family:ui-monospace,Menlo,monospace;white-space:pre-wrap;word-break:break-word}
  .scroll{overflow-x:auto}
</style></head><body>
  <h1>Funnel &amp; ops</h1>
  <div class="sub">Last ${days} days · conversion events only (visits live in Cloudflare Web Analytics). Refreshes on load.</div>

  <div class="cards">
    <div class="card"><div class="v">${t('story_open')}</div><div class="l">Story opens</div></div>
    <div class="card"><div class="v">${t('subscribe_click')}</div><div class="l">Sub. clicks</div></div>
    <div class="card"><div class="v">${t('subscribe_success')}</div><div class="l">Sub. completed</div></div>
    <div class="card"><div class="v">${pct(t('subscribe_success'), t('subscribe_click'))}</div><div class="l">Click→complete</div></div>
    <div class="card"><div class="v">${t('prompt_copy')}</div><div class="l">Prompt copies</div></div>
  </div>

  <h2>Subscribe funnel</h2>
  <table><thead><tr><th>Stage</th><th class="n">Count</th><th>Rate</th></tr></thead><tbody>${funnelRows}</tbody></table>

  <h2>All events (window total)</h2>
  <table><thead><tr><th>Event</th><th class="n">Count</th></tr></thead><tbody>${eventRows}</tbody></table>

  <h2>By day</h2>
  <div class="scroll"><table><thead><tr><th>Day</th>${EVENTS.map(([, l]) => `<th class="n">${esc(l.split(' ')[0])}</th>`).join('')}</tr></thead><tbody>${dayRows}</tbody></table></div>

  <h2>CSP Report-Only — recent violations</h2>
  <div class="scroll"><table><thead><tr><th>When</th><th>Directive</th><th>Blocked</th></tr></thead><tbody>${cspRows}</tbody></table></div>

  <h2>Cron run-state</h2>
  <div class="ops">feeds:   ${runLine(feeds)}
welcome: ${runLine(welcome)}
winback: ${runLine(winback)}</div>
</body></html>`;

  return new Response(html, { status: 200, headers: { 'Content-Type': 'text/html; charset=utf-8', 'Cache-Control': 'no-store' } });
}
