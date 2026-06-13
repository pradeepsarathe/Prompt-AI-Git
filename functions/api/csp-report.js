// functions/api/csp-report.js
// POST /api/csp-report — sink for Content-Security-Policy-Report-Only reports.
//
// The Report-Only CSP in _headers points report-uri here. Nothing is blocked
// (Report-Only never blocks); this just lets you SEE what a future enforced
// policy would break, so you can tighten it safely. Aggregates by violated
// directive into a daily counter + keeps a small rolling sample. View at
// /metrics. First-party only; we store directive + blocked-URI host, no PII.

function noContent() {
  return new Response(null, { status: 204, headers: { 'Cache-Control': 'no-store' } });
}

export async function onRequest(context) {
  const { request, env } = context;
  if (request.method !== 'POST' || !env.STATS) return noContent();
  try {
    const raw = await request.text();
    if (!raw) return noContent();
    let body;
    try { body = JSON.parse(raw); } catch (e) { return noContent(); }

    // Browsers send either {"csp-report":{...}} or the reporting-API array form.
    const reports = Array.isArray(body) ? body.map((r) => r.body || r) : [body['csp-report'] || body];
    const day = new Date().toISOString().slice(0, 10);

    for (const r of reports.slice(0, 5)) {
      if (!r) continue;
      const directive = String(r['violated-directive'] || r['effectiveDirective'] || r.effectiveDirective || 'unknown')
        .split(' ')[0].replace(/[^a-z0-9-]/gi, '').slice(0, 40) || 'unknown';
      const blocked = String(r['blocked-uri'] || r.blockedURL || '').slice(0, 200);

      const key = 'csp:' + day + ':' + directive;
      const n = parseInt((await env.STATS.get(key)) || '0', 10) || 0;
      await env.STATS.put(key, String(n + 1), { expirationTtl: 60 * 60 * 24 * 30 });

      // Rolling sample (last 25) so you can see WHAT got flagged.
      try {
        const sraw = await env.STATS.get('csp:samples');
        const arr = sraw ? JSON.parse(sraw) : [];
        arr.unshift({ at: new Date().toISOString(), directive, blocked });
        await env.STATS.put('csp:samples', JSON.stringify(arr.slice(0, 25)), { expirationTtl: 60 * 60 * 24 * 30 });
      } catch (e) {}
    }
  } catch (e) { /* swallow */ }
  return noContent();
}
