// functions/api/summarize.js
// ═══════════════════════════════════════════════════════════════════
// POST /api/summarize — ~100-word AI summary for ANY opened item
// (news, research, blogs, HN…). Shown in the story modal.
//
// Body: { url, title, desc }
// Returns: { summary, cached } or { offline:true } when AI is absent.
//
// Strategy:
//   • KV cache per URL (30 days) — most opens hit the cache.
//   • If the RSS description is thin (<300 chars), fetch the article
//     server-side and extract paragraph text to summarize from.
//   • Per-IP rate limit on FRESH generations (30/hour) so one visitor
//     can't drain the free Workers AI quota.
// Requires: STATS KV binding + an AI (Workers AI) binding named "AI".
// ═══════════════════════════════════════════════════════════════════

import { aiStorySummary } from '../lib/feedlib.js';

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

// ── SSRF guard (review #6) — only public http(s) hostnames may be fetched.
// Rejects IP-literal hosts (v4 + v6), localhost / internal-looking names and
// userinfo URLs; every redirect hop is re-validated (capped at 3 redirects).
function safeRemoteUrl(raw) {
  let u;
  try { u = new URL(raw); } catch (e) { return null; }
  if (u.protocol !== 'http:' && u.protocol !== 'https:') return null;
  if (u.username || u.password) return null;
  const h = (u.hostname || '').toLowerCase().replace(/\.$/, '');
  if (!h || !h.includes('.')) return null;                    // bare names: localhost, kv, metadata…
  if (h.startsWith('[') || h.includes(':')) return null;      // any IPv6 literal
  if (/^\d{1,3}(\.\d{1,3}){3}$/.test(h)) return null;         // any IPv4 literal — articles live on hostnames
  if (/(^|\.)(localhost|local|internal|home\.arpa|in-addr\.arpa)$/.test(h)) return null;
  return u;
}

// Fetch the article and pull readable paragraph text out of the HTML.
async function fetchArticleText(url) {
  try {
    let target = safeRemoteUrl(url);
    if (!target) return '';
    let r = null;
    for (let hop = 0; hop < 4; hop++) {
      const ctrl = new AbortController();
      const t = setTimeout(() => ctrl.abort(), 6000);
      r = await fetch(target.toString(), {
        signal: ctrl.signal,
        redirect: 'manual',
        headers: { 'User-Agent': 'Mozilla/5.0 (compatible; PromptAI-Summarizer/1.0; +https://promptai.in)' },
        cf: { cacheTtl: 3600, cacheEverything: true },
      });
      clearTimeout(t);
      if (r.status >= 301 && r.status <= 308) {
        const loc = r.headers.get('location') || '';
        target = safeRemoteUrl(new URL(loc, target).toString());
        if (!target) return '';
        continue;
      }
      break;
    }
    if (!r || !r.ok) return '';
    const ct = r.headers.get('content-type') || '';
    if (!ct.includes('text/html') && !ct.includes('application/xhtml')) return '';
    let html = (await r.text()).slice(0, 600000);
    html = html
      .replace(/<script[\s\S]*?<\/script>/gi, ' ')
      .replace(/<style[\s\S]*?<\/style>/gi, ' ')
      .replace(/<!--[\s\S]*?-->/g, ' ')
      .replace(/<(nav|header|footer|aside|form)[\s\S]*?<\/\1>/gi, ' ');
    // Prefer paragraph content; fall back to the whole body if too little.
    const ps = [...html.matchAll(/<p[^>]*>([\s\S]*?)<\/p>/gi)].map(m => m[1]);
    let text = ps.join(' ');
    if (text.length < 400) text = html;
    text = text
      .replace(/<[^>]+>/g, ' ')
      .replace(/&(?:amp|lt|gt|quot|#39|nbsp|mdash|ndash|hellip|rsquo|lsquo|ldquo|rdquo);/g, ' ')
      .replace(/&[a-z#0-9]+;/gi, ' ')
      .replace(/\s+/g, ' ')
      .trim();
    return text.slice(0, 4000);
  } catch (e) { return ''; }
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
  if (!safeRemoteUrl(url)) return json({ error: 'URL not allowed' }, 400);

  const key = 'sum:' + await urlHash(url);

  // Cache first — published items don't change.
  try {
    const hit = await env.STATS.get(key);
    if (hit) return json({ summary: hit, cached: true });
  } catch (e) {}

  if (!env.AI) return json({ offline: true, error: 'AI binding not configured' });

  // Rate limit FRESH generations: 30 per IP per hour.
  const ip = request.headers.get('CF-Connecting-IP') || 'unknown';
  const rlKey = 'rl:sum:' + ip;
  try {
    const n = parseInt(await env.STATS.get(rlKey) || '0', 10);
    if (n >= 30) return json({ error: 'Rate limited — try again in a bit.' }, 429);
    await env.STATS.put(rlKey, String(n + 1), { expirationTtl: 3600 });
  } catch (e) { /* fail open */ }

  // Material: use the RSS description when substantial; otherwise read the article.
  let material = desc;
  if (material.replace(/\s+/g, ' ').trim().length < 300) {
    const fetched = await fetchArticleText(url);
    if (fetched.length > material.length) material = fetched;
  }
  if (!material || material.length < 80) {
    return json({ offline: true, error: 'Not enough source text to summarize' });
  }

  const summary = await aiStorySummary(env, title, material);
  if (!summary) return json({ offline: true, error: 'Generation failed' });

  try { await env.STATS.put(key, summary, { expirationTtl: 60 * 60 * 24 * 30 }); } catch (e) {}
  return json({ summary, cached: false });
}
