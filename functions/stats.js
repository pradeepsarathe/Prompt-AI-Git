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
// Per-URL read counts — powers honest "Trending" + search ranking (review #5).
const POPULAR_KEY = 'popular';
// Funnel events (review #10) — named daily counters, e:YYYY-MM-DD:<name>.
const EVENTS = ['modal_open', 'subscribe_submit', 'subscribe_success', 'sample_issue_click', 'explain_click', 'search_used'];

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
  const [total, today, days, aTotal, aToday, popRaw] = await Promise.all([
    readNum(kv, TOTAL_KEY),
    readNum(kv, dayKey()),
    countDays(kv),
    readNum(kv, A_TOTAL_KEY),
    readNum(kv, aDayKey()),
    kv.get(POPULAR_KEY),
  ]);
  let popular = {};
  try { popular = JSON.parse(popRaw || '{}') || {}; } catch (e) {}
  return {
    totalVisitors: total, todayVisitors: today, days,
    articlesReadTotal: aTotal, articlesReadToday: aToday, popular,
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
      // Actions: 'read' bumps ARTICLE counters (+ the per-URL popularity map),
      // 'event' bumps a named funnel counter, anything else (default 'visit')
      // bumps the VISITOR counters. Legacy clients send {read:<url>} with no
      // action — treat that as a read, NOT a visit (it used to inflate visits).
      let body = {};
      try { body = (await request.json()) || {}; } catch (e) {}
      const action = body.action || (body.read ? 'read' : 'visit');

      if (action === 'event') {
        const name = String(body.name || '');
        if (!EVENTS.includes(name)) return json({ ok: false, error: 'Unknown event' }, 400);
        const key = 'e:' + new Date().toISOString().slice(0, 10) + ':' + name;
        const n = await readNum(kv, key);
        await kv.put(key, String(n + 1), { expirationTtl: 60 * 60 * 24 * 180 });
        return json({ ok: true });
      }

      if (action === 'read') {
        const tKey = aDayKey();
        const [aTotal, aToday] = await Promise.all([readNum(kv, A_TOTAL_KEY), readNum(kv, tKey)]);
        const writes = [
          kv.put(A_TOTAL_KEY, String(aTotal + 1)),
          kv.put(tKey, String(aToday + 1), { expirationTtl: 60 * 60 * 24 * 120 }),
        ];
        // Per-URL popularity — read-modify-write on one JSON map, pruned to the
        // top 300. KV is eventually consistent; a rare lost increment is fine.
        const u = typeof body.read === 'string' ? body.read.slice(0, 500)
          : (typeof body.url === 'string' ? body.url.slice(0, 500) : '');
        if (u && /^https?:\/\//.test(u)) {
          try {
            const pop = JSON.parse(await kv.get(POPULAR_KEY) || '{}') || {};
            pop[u] = (pop[u] || 0) + 1;
            const trimmed = Object.fromEntries(Object.entries(pop).sort((a, b) => b[1] - a[1]).slice(0, 300));
            writes.push(kv.put(POPULAR_KEY, JSON.stringify(trimmed), { expirationTtl: 60 * 60 * 24 * 30 }));
          } catch (e) { /* non-fatal */ }
        }
        await Promise.all(writes);
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

    // GET — ?events=YYYY-MM-DD returns that day's funnel-event counts;
    // otherwise just report current totals.
    const evDate = new URL(request.url).searchParams.get('events');
    if (evDate && /^\d{4}-\d{2}-\d{2}$/.test(evDate)) {
      const prefix = 'e:' + evDate + ':';
      const events = {};
      let cursor;
      do {
        const page = await kv.list({ prefix, cursor, limit: 1000 });
        for (const k of page.keys) events[k.name.slice(prefix.length)] = await readNum(kv, k.name);
        cursor = page.list_complete ? null : page.cursor;
      } while (cursor);
      return json({ date: evDate, events });
    }
    return json(await snapshot(kv));
  } catch (err) {
    return json({ offline: true, error: err.message, totalVisitors: 0, todayVisitors: 0, days: 0, articlesReadTotal: 0, articlesReadToday: 0 });
  }
}
