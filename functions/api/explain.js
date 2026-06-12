// functions/api/explain.js
// ═══════════════════════════════════════════════════════════════════
// POST /api/explain — "Explain this paper" (R30, Workers AI).
//
// Body: { url, title, desc }
// Returns: { explanation, cached } — explanation is plain text with
// "What it does / Why it matters / In plain English" sections.
//
// Explanations are cached in KV per-URL forever (papers don't change),
// and requests are rate-limited per IP so the free Workers AI quota
// can't be drained by one visitor.
// Requires: STATS KV binding + an AI (Workers AI) binding named "AI".
// ═══════════════════════════════════════════════════════════════════

import { aiExplain } from '../lib/feedlib.js';

const json = (obj, status = 200) =>
  new Response(JSON.stringify(obj), {
    status,
    headers: {
      'Content-Type': 'application/json',
      'Access-Control-Allow-Origin': '*',
      'Access-Control-Allow-Methods': 'POST, OPTIONS',
      'Access-Control-Allow-Headers': 'Content-Type',
      'Cache-Control': 'no-store',
    },
  });

async function urlHash(u) {
  const buf = await crypto.subtle.digest('SHA-256', new TextEncoder().encode(u));
  return [...new Uint8Array(buf)].slice(0, 12).map(b => b.toString(16).padStart(2, '0')).join('');
}

export async function onRequest(context) {
  const { request, env } = context;
  if (request.method === 'OPTIONS') return new Response(null, { status: 204, headers: { 'Access-Control-Allow-Origin': '*', 'Access-Control-Allow-Methods': 'POST, OPTIONS', 'Access-Control-Allow-Headers': 'Content-Type' } });
  if (request.method !== 'POST') return json({ error: 'Method not allowed' }, 405);
  if (!env.STATS) return json({ offline: true, error: 'No STATS KV binding' });

  let body;
  try { body = await request.json(); } catch (e) { return json({ error: 'Bad JSON' }, 400); }
  const url = String(body.url || '').slice(0, 500);
  const title = String(body.title || '').slice(0, 300);
  const desc = String(body.desc || '').slice(0, 2000);
  if (!url || !title || !/^https?:\/\//.test(url)) return json({ error: 'url and title required' }, 400);

  const key = 'explain:' + await urlHash(url);

  // Cache first — explanations are immutable.
  try {
    const hit = await env.STATS.get(key);
    if (hit) return json({ explanation: hit, cached: true });
  } catch (e) {}

  if (!env.AI) return json({ offline: true, error: 'AI binding not configured' });

  // Rate limit: 20 fresh generations per IP per hour.
  const ip = request.headers.get('CF-Connecting-IP') || 'unknown';
  const rlKey = 'rl:explain:' + ip;
  try {
    const n = parseInt(await env.STATS.get(rlKey) || '0', 10);
    if (n >= 20) return json({ error: 'Rate limited — try again in a bit.' }, 429);
    await env.STATS.put(rlKey, String(n + 1), { expirationTtl: 3600 });
  } catch (e) { /* fail open */ }

  const explanation = await aiExplain(env, title, desc);
  if (!explanation) return json({ offline: true, error: 'Generation failed' });

  try { await env.STATS.put(key, explanation); } catch (e) {}
  return json({ explanation, cached: false });
}
