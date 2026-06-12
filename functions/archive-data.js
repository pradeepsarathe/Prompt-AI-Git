// functions/archive-data.js
// Cloudflare Pages Function — SHARED archive store for PromptAI.
//
// June 2026 (R3/R36): the archive now has a SINGLE WRITER — the
// server-side aggregator (/api/refresh-feeds) merges new stories into
// KV once per cycle. Browsers no longer POST their own merges, which is
// what caused the read-modify-write races (two visitors loading at the
// same time could clobber each other's writes).
//
// The old 5,000-item hard cap is gone: the hot window (arch:all) keeps
// the newest ~4,000 items, and everything older rolls into monthly
// segments (arch:seg:YYYY-MM) instead of being dropped — papers and
// blogs are never lost.
//
// Endpoints:
//   GET /archive-data?type=&q=&topic=&limit=      → hot window
//   GET /archive-data?month=YYYY-MM&type=&q=      → one cold segment
//   GET /archive-data?months=1                    → { months:[...] }
//   POST (deprecated)                             → { count, added:0 }

const ARCH_KEY = 'arch:all';

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

async function loadJson(kv, key) {
  try {
    const raw = await kv.get(key);
    const arr = raw ? JSON.parse(raw) : [];
    return Array.isArray(arr) ? arr : [];
  } catch (e) { return []; }
}

export async function onRequest(context) {
  const { request, env } = context;
  if (request.method === 'OPTIONS') return new Response(null, { status: 204, headers: { 'Access-Control-Allow-Origin': '*', 'Access-Control-Allow-Methods': 'GET, POST, OPTIONS', 'Access-Control-Allow-Headers': 'Content-Type' } });

  if (!env.STATS) return json({ offline: true, items: [], total: 0 });
  const kv = env.STATS;

  try {
    // ── WRITE: deprecated. The aggregator is the single writer now. ──
    // Old cached clients may still POST; acknowledge without merging so
    // they can't race the server-side writer.
    if (request.method === 'POST') {
      const cur = await loadJson(kv, ARCH_KEY);
      return json({ count: cur.length, added: 0, deprecated: true });
    }

    const url = new URL(request.url);

    // ── list available cold segments ──
    if (url.searchParams.get('months')) {
      const months = [];
      let cursor;
      do {
        const page = await kv.list({ prefix: 'arch:seg:', cursor, limit: 1000 });
        months.push(...page.keys.map(k => k.name.slice(9)));
        cursor = page.list_complete ? null : page.cursor;
      } while (cursor);
      return json({ months: months.sort().reverse() });
    }

    // ── READ: hot window or one cold segment ──
    const month = (url.searchParams.get('month') || '').trim();
    const key = /^\d{4}-\d{2}$/.test(month) ? ('arch:seg:' + month) : ARCH_KEY;

    const type = (url.searchParams.get('type') || 'all').toLowerCase();
    const topic = (url.searchParams.get('topic') || '').trim().toLowerCase();
    const q = (url.searchParams.get('q') || '').trim().toLowerCase();
    const limit = Math.min(parseInt(url.searchParams.get('limit') || '2000', 10) || 2000, 6000);

    let items = await loadJson(kv, key);
    const total = items.length;
    if (type !== 'all') items = items.filter(i => i.type === type);
    if (topic) items = items.filter(i => (i.topic || '').toLowerCase() === topic);
    if (q) items = items.filter(i =>
      (i.title || '').toLowerCase().includes(q) || (i.desc || '').toLowerCase().includes(q));

    return json({ items: items.slice(0, limit), total });
  } catch (err) {
    return json({ offline: true, error: err.message, items: [], total: 0 });
  }
}
