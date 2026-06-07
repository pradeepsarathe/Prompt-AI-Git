// functions/stats.js
// Cloudflare Pages Function — GLOBAL visitor counter for PromptAI.
//
// Why this exists:
//   The old counter lived in localStorage, so every device/browser had its own
//   number and it "reset every day". This stores ONE shared, monotonic count in
//   Cloudflare KV so the visitor total is the same on every device and never
//   silently drops.
//
// Setup (one time):
//   Cloudflare Pages → Settings → Functions → KV namespace bindings
//   → add a binding named   STATS   pointing at a KV namespace.
//   (The same STATS binding is also used by functions/archive-data.js.)
//
// Endpoints:
//   GET  /stats                 → { totalVisitors, todayVisitors, days, offline? }
//   POST /stats {action:'visit'}→ increments the counter once, returns fresh totals
//
// If the STATS binding is missing it returns offline:true (200) so the client
// falls back to its local number gracefully — the site never breaks.

const json = (obj, status = 200) =>
  new Response(JSON.stringify(obj), {
    status,
    headers: {
      'Content-Type': 'application/json',
      'Access-Control-Allow-Origin': '*',
      'Access-Control-Allow-Methods': 'GET, POST, OPTIONS',
      'Access-Control-Allow-Headers': 'Content-Type',
      'Cache-Control': 'no-store',
    },
  });

const dayKey = () => 'v:day:' + new Date().toISOString().slice(0, 10); // v:day:YYYY-MM-DD
const TOTAL_KEY = 'v:total';
// Article-read counters (separate namespace from visitors).
const aDayKey = () => 'a:day:' + new Date().toISOString().slice(0, 10); // a:day:YYYY-MM-DD
const A_TOTAL_KEY = 'a:total';

async function readNum(kv, key) {
  const raw = await kv.get(key);
  const n = parseInt(raw || '0', 10);
  return Number.isFinite(n) ? n : 0;
}

// Count how many distinct days have a visit key (cheap list, prefix-scoped).
async function countDays(kv) {
  let days = 0, cursor;
  do {
    const page = await kv.list({ prefix: 'v:day:', cursor, limit: 1000 });
    days += page.keys.length;
    cursor = page.list_complete ? null : page.cursor;
  } while (cursor);
  return days;
}

async function snapshot(kv) {
  const [total, today, days, aTotal, aToday] = await Promise.all([
    readNum(kv, TOTAL_KEY),
    readNum(kv, dayKey()),
    countDays(kv),
    readNum(kv, A_TOTAL_KEY),
    readNum(kv, aDayKey()),
  ]);
  return {
    totalVisitors: total, todayVisitors: today, days,
    articlesReadTotal: aTotal, articlesReadToday: aToday,
  };
}

export async function onRequest(context) {
  const { request, env } = context;

  if (request.method === 'OPTIONS') return json({}, 204);

  // No KV → tell the client to use its local fallback number.
  if (!env.STATS) return json({ offline: true, totalVisitors: 0, todayVisitors: 0, days: 0, articlesReadTotal: 0, articlesReadToday: 0 });

  const kv = env.STATS;

  try {
    if (request.method === 'POST') {
      // Distinguish the action: 'read' bumps the ARTICLE counters, anything else
      // (default 'visit') bumps the VISITOR counters. KV is eventually consistent;
      // for this traffic level a rare lost increment is fine and counts only grow.
      let action = 'visit';
      try { const body = await request.json(); if (body && body.action) action = body.action; } catch (e) {}

      if (action === 'read') {
        const tKey = aDayKey();
        const [aTotal, aToday] = await Promise.all([readNum(kv, A_TOTAL_KEY), readNum(kv, tKey)]);
        await Promise.all([
          kv.put(A_TOTAL_KEY, String(aTotal + 1)),
          kv.put(tKey, String(aToday + 1), { expirationTtl: 60 * 60 * 24 * 120 }),
        ]);
        return json(await snapshot(kv));
      }

      // Default: a visit.
      const tKey = dayKey();
      const [total, today] = await Promise.all([readNum(kv, TOTAL_KEY), readNum(kv, tKey)]);
      await Promise.all([
        kv.put(TOTAL_KEY, String(total + 1)),
        // day buckets expire after ~120 days so the "days of history" stays sane
        kv.put(tKey, String(today + 1), { expirationTtl: 60 * 60 * 24 * 120 }),
      ]);
      return json(await snapshot(kv));
    }

    // GET → just report current totals
    return json(await snapshot(kv));
  } catch (err) {
    return json({ offline: true, error: err.message, totalVisitors: 0, todayVisitors: 0, days: 0, articlesReadTotal: 0, articlesReadToday: 0 });
  }
}
