// functions/archive-data.js
// Cloudflare Pages Function — SHARED archive store for PromptAI.
//
// Why this exists:
//   The archive used to be built from whatever feeds happened to load in THIS
//   browser, so the count jumped around (100+, then 33, …) and differed per
//   device. This keeps one shared, growing archive in Cloudflare KV so every
//   visitor sees the same history.
//
// Retention rules (per request):
//   • news        → kept for 90 days, then pruned
//   • paper, blog → kept forever
//
// Setup (one time):
//   Cloudflare Pages → Settings → Functions → KV namespace bindings
//   → add a binding named   STATS   (shared with functions/stats.js).
//
// Endpoints:
//   GET  /archive-data?type=&q=&limit=   → { items:[...], total, offline? }
//   POST /archive-data { items:[...] }   → merges items, prunes, returns { count }
//
// Each item:  { url, title, desc, src, type, savedAt }
// If the STATS binding is missing, returns offline:true so the client uses its
// own localStorage archive as a fallback (site keeps working).

const ARCH_KEY = 'arch:all';
const NEWS_TTL_MS = 90 * 24 * 60 * 60 * 1000; // 90 days
const MAX_ITEMS = 5000;                        // hard cap to keep the KV value small

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

async function loadAll(kv) {
  try {
    const raw = await kv.get(ARCH_KEY);
    const arr = raw ? JSON.parse(raw) : [];
    return Array.isArray(arr) ? arr : [];
  } catch (e) { return []; }
}

// Drop news older than 90 days; keep papers + blogs forever.
function prune(items) {
  const cutoff = Date.now() - NEWS_TTL_MS;
  return items
    .filter(i => i && i.url && i.title)
    .filter(i => i.type === 'news' ? (i.savedAt || 0) >= cutoff : true)
    .sort((a, b) => (b.savedAt || 0) - (a.savedAt || 0))
    .slice(0, MAX_ITEMS);
}

export async function onRequest(context) {
  const { request, env } = context;
  if (request.method === 'OPTIONS') return json({}, 204);

  if (!env.STATS) return json({ offline: true, items: [], total: 0 });
  const kv = env.STATS;

  try {
    // ── WRITE: merge new items in ──────────────────────────
    if (request.method === 'POST') {
      let body;
      try { body = await request.json(); } catch (e) { return json({ error: 'Bad JSON' }, 400); }
      const incoming = Array.isArray(body.items) ? body.items : [];
      if (!incoming.length) {
        const cur = await loadAll(kv);
        return json({ count: cur.length, added: 0 });
      }

      const existing = await loadAll(kv);
      const byUrl = new Map(existing.map(i => [i.url, i]));
      let added = 0;
      for (const it of incoming) {
        if (!it || !it.url || !it.title) continue;
        if (!byUrl.has(it.url)) {
          byUrl.set(it.url, {
            url: String(it.url),
            title: String(it.title).slice(0, 400),
            desc: String(it.desc || '').slice(0, 600),
            src: String(it.src || '').slice(0, 40),
            type: ['news', 'paper', 'blog'].includes(it.type) ? it.type : 'news',
            savedAt: Number(it.savedAt) || Date.now(),
          });
          added++;
        }
      }
      const merged = prune([...byUrl.values()]);
      await kv.put(ARCH_KEY, JSON.stringify(merged));
      return json({ count: merged.length, added });
    }

    // ── READ: filtered list ────────────────────────────────
    const url = new URL(request.url);
    const type = (url.searchParams.get('type') || 'all').toLowerCase();
    const q = (url.searchParams.get('q') || '').trim().toLowerCase();
    const limit = Math.min(parseInt(url.searchParams.get('limit') || '2000', 10) || 2000, MAX_ITEMS);

    let items = prune(await loadAll(kv));
    const total = items.length;
    if (type !== 'all') items = items.filter(i => i.type === type);
    if (q) items = items.filter(i =>
      (i.title || '').toLowerCase().includes(q) || (i.desc || '').toLowerCase().includes(q));

    return json({ items: items.slice(0, limit), total });
  } catch (err) {
    return json({ offline: true, error: err.message, items: [], total: 0 });
  }
}
