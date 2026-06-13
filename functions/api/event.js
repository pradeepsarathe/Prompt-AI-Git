// functions/api/event.js
// POST/GET /api/event?n=<name> — minimal first-party funnel counter.
//
// Counts only LOW-VOLUME, HIGH-VALUE conversion events (not pageviews —
// Cloudflare Web Analytics already counts visits, and writing a KV entry per
// pageview would blow the free-tier write budget). The client beacon
// (pai-metrics.js) fires these; the dashboard at /metrics reads them.
//
// Storage: ev:<YYYY-MM-DD>:<name> integer counters in STATS KV (90-day TTL).
// First-party + same-origin; no cookies, no PII, no third parties.

const ALLOW = new Set([
  'story_open',       // a story modal opened (summary fetched)
  'paper_explain',    // "explain this paper" used
  'subscribe_click',  // Subscribe button pressed
  'subscribe_success',// subscribe POST succeeded
  'prompt_copy',      // a prompt was copied to clipboard
  'share_click',      // a share/tweet link clicked
  'sample_click',     // "read a sample issue" clicked
  'push_click',       // enable-notifications clicked
]);

function noContent() {
  return new Response(null, {
    status: 204,
    headers: { 'Cache-Control': 'no-store', 'Access-Control-Allow-Origin': '*' },
  });
}

export async function onRequest(context) {
  const { request, env } = context;
  if (request.method === 'OPTIONS') return noContent();

  try {
    const url = new URL(request.url);
    let name = (url.searchParams.get('n') || '').trim();
    if (!name && request.method === 'POST') {
      try { const b = await request.json(); name = String(b.n || b.name || '').trim(); } catch (e) {}
    }
    if (!ALLOW.has(name) || !env.STATS) return noContent();

    const day = new Date().toISOString().slice(0, 10);
    const key = 'ev:' + day + ':' + name;
    const n = parseInt((await env.STATS.get(key)) || '0', 10) || 0;
    await env.STATS.put(key, String(n + 1), { expirationTtl: 60 * 60 * 24 * 90 });
  } catch (e) { /* never error a beacon */ }
  return noContent();
}
