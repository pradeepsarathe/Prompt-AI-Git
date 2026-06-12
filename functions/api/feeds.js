// functions/api/feeds.js
// ═══════════════════════════════════════════════════════════════════
// GET /api/feeds — THE aggregated live feed (R1/R6).
//
// One request replaces the browser's old ~80-request first-visit storm
// (61 HN item fetches + 17 RSS feeds × up-to-4 proxy race attempts).
// The payload is built server-side every ~30 min by /api/refresh-feeds
// (external cron) and cached in KV; this endpoint just serves it.
//
// Self-healing: if the cron hasn't run yet (or is late) it serves the
// stale copy immediately and rebuilds in the background; if the cache
// is empty entirely it builds inline once (skipping the AI summary to
// keep latency sane).
// ═══════════════════════════════════════════════════════════════════

import { buildFeedPayload, readFeedPayload, mergeIntoArchive, FEEDS_KEY, FEEDS_TTL_MS } from '../lib/feedlib.js';

const json = (obj, status = 200, extra) =>
  new Response(JSON.stringify(obj), {
    status,
    headers: Object.assign({
      'Content-Type': 'application/json',
      'Access-Control-Allow-Origin': '*',
      'Cache-Control': 'public, max-age=300',
    }, extra || {}),
  });

async function refreshInBackground(env) {
  const kv = env.STATS;
  // KV-based stampede lock — only one isolate rebuilds at a time.
  const lock = await kv.get('feeds:lock');
  if (lock) return;
  await kv.put('feeds:lock', String(Date.now()), { expirationTtl: 120 });
  try {
    const payload = await buildFeedPayload(env, { skipAI: false });
    if (payload.news.length + payload.blogs.length + payload.papers.length > 0) {
      // Keep the previous AI summary if this run produced none.
      if (!payload.summary) {
        const prev = await readFeedPayload(kv);
        if (prev && prev.summary) payload.summary = prev.summary;
        if (prev && prev.meta && prev.meta.subscribers != null) payload.meta.subscribers = prev.meta.subscribers;
      }
      await kv.put(FEEDS_KEY, JSON.stringify(payload));
      await mergeIntoArchive(kv, payload);
    }
  } catch (e) { /* next request retries */ }
}

export async function onRequest(context) {
  const { request, env } = context;
  if (request.method === 'OPTIONS') {
    return new Response(null, { headers: { 'Access-Control-Allow-Origin': '*', 'Access-Control-Allow-Methods': 'GET, OPTIONS' } });
  }
  if (!env.STATS) return json({ offline: true, error: 'No STATS KV binding' }, 200, { 'Cache-Control': 'no-store' });

  const cached = await readFeedPayload(env.STATS);
  const age = cached ? Date.now() - Date.parse(cached.generatedAt || 0) : Infinity;

  if (cached && age < FEEDS_TTL_MS) return json(cached);

  if (cached) {
    // Stale: serve immediately, rebuild in the background.
    context.waitUntil(refreshInBackground(env));
    return json(cached, 200, { 'X-Feed-Stale': '1' });
  }

  // Cold start: build inline once (no AI summary — keep it fast-ish).
  try {
    const payload = await buildFeedPayload(env, { skipAI: true });
    if (payload.news.length + payload.blogs.length + payload.papers.length > 0) {
      context.waitUntil((async () => {
        await env.STATS.put(FEEDS_KEY, JSON.stringify(payload));
        await mergeIntoArchive(env.STATS, payload);
      })());
      return json(payload, 200, { 'Cache-Control': 'public, max-age=120' });
    }
    return json({ offline: true, error: 'All feeds failed' }, 200, { 'Cache-Control': 'no-store' });
  } catch (e) {
    return json({ offline: true, error: e.message }, 200, { 'Cache-Control': 'no-store' });
  }
}
