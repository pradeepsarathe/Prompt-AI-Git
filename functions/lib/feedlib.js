// functions/lib/feedlib.js
// ═══════════════════════════════════════════════════════════════════
// Shared server-side feed machinery (R1/R2).
//   • fetch + parse RSS/Atom (no DOMParser in Workers — regex parser)
//   • image extraction, entity decoding, quality + relevance filters
//   • topic classification (same rules the client used)
//   • buildFeedPayload(env) — the aggregated payload /api/feeds serves
//   • aiSummary / aiExplain — Workers AI helpers (R30)
//   • mergeIntoArchive — single-writer KV archive merge (R3/R36)
//   • hmacSign / hmacVerify — signed unsubscribe links (R17)
// Imported by api/feeds.js, api/refresh-feeds.js, send-digest.js, …
// (This file defines no route — it exports no onRequest.)
// ═══════════════════════════════════════════════════════════════════

import {
  SRC_META, WEB_NEWS_FEEDS, WEB_BLOG_FEEDS, ARXIV_FEEDS, ARXIV_API, PAPER_CAT_MAP,
} from './sources.js';

// ── tiny XML helpers ────────────────────────────────────────────────
export function tagText(block, name) {
  const m = block.match(new RegExp('<' + name + '[^>]*>([\\s\\S]*?)<\\/' + name + '>', 'i'));
  return m ? m[1] : '';
}
export function decodeEntities(s) {
  return (s || '')
    .replace(/<!\[CDATA\[([\s\S]*?)\]\]>/g, '$1')
    .replace(/<[^>]+>/g, ' ')
    .replace(/&amp;/g, '&').replace(/&lt;/g, '<').replace(/&gt;/g, '>')
    .replace(/&quot;/g, '"').replace(/&#0*39;|&apos;/g, "'")
    .replace(/&#(\d+);/g, (_, n) => String.fromCharCode(+n))
    .replace(/&#x([0-9a-f]+);/gi, (_, n) => String.fromCharCode(parseInt(n, 16)))
    .replace(/\s+/g, ' ').trim();
}
export function truncate(s, n) { s = s || ''; return s.length > n ? s.slice(0, n - 1).trim() + '…' : s; }
export function domainOf(u) { try { return new URL(u).hostname.replace('www.', ''); } catch (e) { return u; } }
export function withTimeout(promise, ms, fallback) {
  return Promise.race([promise, new Promise(res => setTimeout(() => res(fallback), ms))]);
}

// ── image extraction ────────────────────────────────────────────────
export function pickImage(block) {
  if (!block) return '';
  const cands = [];
  let m;
  const mediaRe = /<media:(?:content|thumbnail)\b[^>]*\burl=["']([^"']+)["']/gi;
  while ((m = mediaRe.exec(block))) cands.push(m[1]);
  const encRe = /<enclosure\b[^>]*>/gi;
  while ((m = encRe.exec(block))) {
    const tag = m[0];
    const um = tag.match(/\burl=["']([^"']+)["']/i);
    if (um && (/type=["']image\//i.test(tag) || isImgUrl(um[1]))) cands.push(um[1]);
  }
  m = block.match(/<itunes:image\b[^>]*\bhref=["']([^"']+)["']/i); if (m) cands.push(m[1]);
  m = block.match(/<image\b[^>]*>[\s\S]*?<url>([\s\S]*?)<\/url>/i);  if (m) cands.push(m[1]);
  const imgRe = /<img\b[^>]*\bsrc=["']([^"']+)["']/gi;
  while ((m = imgRe.exec(block))) cands.push(m[1]);
  for (const c of cands) { const u = cleanImg(c); if (u) return u; }
  return '';
}
export function cleanImg(u) {
  if (!u) return '';
  u = decodeEntities(String(u)).trim();
  if (u.startsWith('//')) u = 'https:' + u;
  if (!/^https?:\/\//i.test(u)) return '';
  if (/feedburner|doubleclick|googlesyndication|\/pixel|1x1|spacer|gravatar|\.svg(\?|$)/i.test(u)) return '';
  return u;
}
function isImgUrl(u) { return /\.(jpe?g|png|webp|avif|gif)(\?|$)/i.test(u || ''); }
export function firstImgIn(html) {
  const m = (html || '').match(/<img\b[^>]*\bsrc=["']([^"']+)["']/i);
  return m ? m[1] : '';
}

// ── topic classification + relevance (mirrors the old client rules) ─
const TOPIC_RULES = [
  ['Agents',   /\b(agent|agentic|autonomous|tool[- ]?use|multi[- ]?agent|orchestrat)\b/i],
  ['Vision',   /\b(vision|image generation|video|diffusion|midjourney|dall[- ]?e|stable diffusion|multimodal|segmentation)\b/i],
  ['Robotics', /\b(robot|robotics|embodied|drone|self[- ]?driving|autonomous vehicle|manipulation)\b/i],
  ['Policy',   /\b(regulat|policy|governance|alignment|ai safety|ethic|copyright|lawsuit|\bban\b|eu ai act)\b/i],
  ['Research', /\b(benchmark|arxiv|\bstudy\b|researchers?|state[- ]of[- ]the[- ]art|\bsota\b|fine[- ]?tun|pre[- ]?train|dataset)\b/i],
  ['Tools',    /\b(launch|release|\bapi\b|\bsdk\b|platform|plugin|available now|now available|rolls out)\b/i],
  ['LLMs',     /\b(llm|gpt|claude|gemini|llama|mistral|language model|chatbot|prompt|context window|\brag\b)\b/i],
];
export function classifyTopic(title, desc) {
  const text = title + ' ' + (desc || '');
  for (const [name, re] of TOPIC_RULES) { if (re.test(text)) return name; }
  return 'General';
}
export const TOPIC_SLUGS = {
  agents: 'Agents', vision: 'Vision', robotics: 'Robotics', policy: 'Policy',
  research: 'Research', tools: 'Tools', llms: 'LLMs',
};

const AI_RELEVANCE = /\b(AI|A\.I\.|artificial intelligence|machine learning|\bML\b|LLM|GPT|chatbot|deep learning|neural|openai|anthropic|claude|gemini|llama|mistral|robotics|automation|transformer|diffusion|agent|RAG|model|inference|fine[- ]?tun|dataset|benchmark|nvidia|deepmind)\b/i;
const SPAM_NEG = /\b(casino|coupon|horoscope|betting|airdrop|forex|essay writing service|buy now|discount code|porn|viagra)\b/i;

function passesQuality(title, desc) {
  if (!title || title.trim().length < 15 || title.length > 250) return false;
  if (/<[a-zA-Z]/.test(title) || /https?:\/\//.test(title)) return false;
  if (/[{}\[\]\\;]/.test(title)) return false;
  if (/^[\d\s.,!?:-]+$/.test(title)) return false;
  if (SPAM_NEG.test(title + ' ' + (desc || ''))) return false;
  return true;
}

// ── RSS/Atom fetch + parse ──────────────────────────────────────────
export function parseFeed(xml, take) {
  const isRss = /<item[\s>]/i.test(xml);
  const chunks = xml.split(isRss ? /<item[\s>]/i : /<entry[\s>]/i).slice(1);
  const out = [];
  for (const block of chunks) {
    const title = decodeEntities(tagText(block, 'title'));
    let link = decodeEntities(tagText(block, 'link'));
    if (!link || /^https?:/.test(link) === false) {
      const lm = block.match(/<link[^>]*href=["']([^"']+)["']/i);
      if (lm) link = lm[1];
    }
    const descRaw = tagText(block, 'description') || tagText(block, 'summary') || tagText(block, 'content');
    const desc = truncate(decodeEntities(descRaw), 220);
    const img = pickImage(block);
    const dt = tagText(block, 'pubDate') || tagText(block, 'published') || tagText(block, 'updated') || tagText(block, 'dc:date');
    const cats = [];
    const catRe = /<category[^>]*(?:term=["']([^"']+)["'][^>]*)?>([\s\S]*?)<\/category>|<category[^>]*term=["']([^"']+)["'][^>]*\/>/gi;
    let cm;
    while ((cm = catRe.exec(block))) cats.push(decodeEntities(cm[1] || cm[2] || cm[3] || ''));
    if (title && link) out.push({ title, link, desc, img, cats, date: dt ? new Date(dt) : new Date(0) });
    if (out.length >= take) break;
  }
  return out;
}

export async function fetchDirect(feed, take) {
  const ac = new AbortController();
  const t = setTimeout(() => ac.abort(), 7000);
  try {
    const r = await fetch(feed, {
      signal: ac.signal,
      headers: {
        'User-Agent': 'Mozilla/5.0 (compatible; PromptAI/1.0; +https://promptai.in)',
        'Accept': 'application/rss+xml, application/atom+xml, application/xml, text/xml, */*',
      },
      cf: { cacheTtl: 900, cacheEverything: true },
    });
    if (!r.ok) return [];
    const xml = await r.text();
    if (!xml || xml.length < 100) return [];
    const header = xml.split(/<item[\s>]/i)[0] || xml;
    const feedTitle = (decodeEntities(tagText(header, 'title')) || domainOf(feed)).replace(/\s*[-–|].*$/, '').trim();
    return parseFeed(xml, take).map(i => ({ ...i, feedTitle }));
  } catch (e) { return []; }
  finally { clearTimeout(t); }
}

export async function fetchViaRss2json(feed, take) {
  const ac = new AbortController();
  const t = setTimeout(() => ac.abort(), 7000);
  try {
    const r = await fetch('https://api.rss2json.com/v1/api.json?rss_url=' + encodeURIComponent(feed), { signal: ac.signal });
    const data = await r.json();
    if (data.status === 'ok' && data.items?.length) {
      const feedTitle = (data.feed?.title || domainOf(feed)).replace(/\s*[-–|].*$/, '').trim();
      return data.items.slice(0, take).map(item => ({
        title: (item.title || '').trim(),
        link: item.link || item.guid || '',
        desc: truncate((item.description || item.content || '').replace(/<[^>]+>/g, '').trim(), 220),
        img: cleanImg(item.thumbnail || item.enclosure?.link || firstImgIn(item.content || item.description || '')),
        cats: Array.isArray(item.categories) ? item.categories : [],
        feedTitle,
        date: item.pubDate ? new Date(item.pubDate) : new Date(0),
      }));
    }
  } catch (e) { /* ignore */ }
  finally { clearTimeout(t); }
  return [];
}

export async function fetchFeedItems(feed, take) {
  const direct = await fetchDirect(feed, take);
  if (direct.length) return direct;
  return fetchViaRss2json(feed, take);
}

export async function mergeFeeds(feeds, perFeed, total) {
  const out = [];
  const settled = await Promise.allSettled(feeds.map(f => fetchFeedItems(f, perFeed)));
  settled.forEach(s => { if (s.status === 'fulfilled') out.push(...s.value); });
  const seen = new Set();
  return out
    .filter(b => b.link && !seen.has(b.link) && seen.add(b.link))
    .sort((a, b) => b.date - a.date)
    .slice(0, total);
}

// ── Hacker News (server-side, replaces the client's 61-request storm) ─
export async function fetchHNStories(max) {
  try {
    const res = await fetch('https://hacker-news.firebaseio.com/v0/topstories.json', { signal: AbortSignal.timeout(6000) });
    const ids = (await res.json()).slice(0, 45);
    const items = await Promise.all(ids.map(id =>
      fetch(`https://hacker-news.firebaseio.com/v0/item/${id}.json`, { signal: AbortSignal.timeout(4000) })
        .then(r => r.json()).catch(() => null)));
    return items
      .filter(i => i && i.title && (AI_RELEVANCE.test(i.title) || AI_RELEVANCE.test(i.text || '')))
      .slice(0, max || 8)
      .map(i => ({
        src: 'hn', title: i.title,
        url: i.url || `https://news.ycombinator.com/item?id=${i.id}`,
        ts: (i.time || 0) * 1000, date: i.time ? new Date(i.time * 1000).toUTCString().slice(0, 16) : '',
        score: i.score || 0, image: '',
        desc: i.text ? truncate(decodeEntities(i.text), 200) : '',
        topic: classifyTopic(i.title, i.text || ''),
      }));
  } catch (e) { return []; }
}

// ── normalize a parsed feed item into the client story shape ────────
function toStory(i, src) {
  return {
    src,
    title: i.title,
    url: i.link,
    date: i.date && +i.date ? i.date.toUTCString().slice(0, 16) : '',
    ts: i.date ? +i.date : 0,
    desc: i.desc || '',
    image: i.img || '',
    topic: classifyTopic(i.title, i.desc),
  };
}

async function fetchKindStories(feeds, perFeed, requireRelevance) {
  const settled = await Promise.allSettled(feeds.map(f => fetchFeedItems(f.url, perFeed)));
  const out = [];
  settled.forEach((s, idx) => {
    if (s.status !== 'fulfilled') return;
    const src = feeds[idx].src;
    s.value.forEach(i => {
      if (!passesQuality(i.title, i.desc)) return;
      if (requireRelevance && !AI_RELEVANCE.test(i.title) && !AI_RELEVANCE.test(i.desc || '')) return;
      out.push(toStory(i, src));
    });
  });
  const seen = new Set();
  return out.filter(s => s.url && !seen.has(s.url) && seen.add(s.url))
    .sort((a, b) => (b.ts || 0) - (a.ts || 0));
}

export async function fetchPapers(cat, max) {
  // API first (returns papers every day, incl. weekends), RSS as fallback.
  let items = await fetchFeedItems(ARXIV_API[cat] || ARXIV_API.all, max || 30);
  if (!items.length) items = await fetchFeedItems(ARXIV_FEEDS[cat] || ARXIV_FEEDS.all, max || 30);
  return items.map(i => {
    const catMatch = (i.cats || []).find(c => PAPER_CAT_MAP[c]) || (i.cats || [])[0] || 'cs.AI';
    const catInfo = PAPER_CAT_MAP[catMatch] || { label: 'AI', cls: 'cat-llm' };
    return {
      title: (i.title || '').replace(/\[.*?\]/g, '').trim(),
      url: i.link,
      desc: truncate(i.desc || '', 300),
      cat: catInfo.label, cls: catInfo.cls,
      authors: 'arXiv',
      date: i.date && +i.date ? i.date.toISOString().slice(0, 10) : '',
      src: 'arxiv',
      topic: 'Research',
    };
  }).filter(p => p.title && p.url);
}

// ── Workers AI (R30) — graceful no-op when the AI binding is absent ─
const AI_MODEL = '@cf/meta/llama-3.1-8b-instruct';

export async function aiSummary(env, stories, papers) {
  if (!env.AI || !stories || !stories.length) return null;
  const heads = stories.slice(0, 12).map((s, i) => `${i + 1}. ${s.title}${s.desc ? ' — ' + s.desc.slice(0, 120) : ''}`).join('\n');
  const paper = papers && papers[0] ? `\nTop new paper: ${papers[0].title}` : '';
  try {
    const r = await withTimeout(env.AI.run(AI_MODEL, {
      messages: [
        { role: 'system', content: 'You are the editor of PromptAI, a daily AI-news briefing. Write tight, factual, jargon-light copy. Never invent facts not present in the headlines given.' },
        { role: 'user', content: `Here are today's top AI headlines:\n${heads}${paper}\n\nWrite "Today in 60 seconds": exactly 4 bullet points, each one sentence (max 22 words), covering the most important distinct developments. No preamble, no numbering — start each line with "• ".` },
      ],
      max_tokens: 320,
    }), 15000, null);
    const text = r && (r.response || '').trim();
    if (!text) return null;
    const bullets = text.split('\n').map(l => l.replace(/^[•\-\*\d.]+\s*/, '').trim()).filter(l => l.length > 15).slice(0, 4);
    if (!bullets.length) return null;
    return { bullets, at: new Date().toISOString(), model: AI_MODEL };
  } catch (e) { return null; }
}

export async function aiExplain(env, title, abstract) {
  if (!env.AI) return null;
  try {
    const r = await withTimeout(env.AI.run(AI_MODEL, {
      messages: [
        { role: 'system', content: 'You explain AI research papers to smart non-experts. Plain language, no hype, no invented details — if the abstract does not say something, do not claim it.' },
        { role: 'user', content: `Paper title: ${title}\nAbstract: ${(abstract || '').slice(0, 1500)}\n\nExplain in three short labelled parts:\nWhat it does: (1-2 sentences)\nWhy it matters: (1-2 sentences)\nIn plain English: (one everyday analogy, 1 sentence)` },
      ],
      max_tokens: 380,
    }), 18000, null);
    const text = r && (r.response || '').trim();
    return text || null;
  } catch (e) { return null; }
}

export async function aiStorySummary(env, title, text) {
  if (!env.AI) return null;
  try {
    const r = await withTimeout(env.AI.run(AI_MODEL, {
      messages: [
        { role: 'system', content: 'You write the in-depth summary for PromptAI, a daily AI briefing. Be factual and plain-spoken. Use ONLY the material given — if it is thin, summarize what is there as fully as possible; never invent specifics, numbers or quotes.' },
        { role: 'user', content: `Title: ${title}\nMaterial:\n${(text || '').slice(0, 7000)}\n\nWrite a thorough summary of about 350–450 words that lets the reader understand the story without leaving the page. Cover what happened, the key details and context, and why it matters. Use 2–4 short paragraphs separated by a blank line. No preamble, no bullet points, no "This article…" opener — start directly with the substance.` },
      ],
      max_tokens: 900,
    }), 22000, null);
    const out = r && (r.response || '').trim();
    if (!out || out.length < 60) return null;
    return out;
  } catch (e) { return null; }
}

// ── aggregated payload (R1) ─────────────────────────────────────────
export const FEEDS_KEY = 'feeds:v1';
export const FEEDS_TTL_MS = 35 * 60 * 1000; // refresh cadence ≈ 30 min cron

export async function buildFeedPayload(env, opts) {
  opts = opts || {};
  const [hn, news, blogs, papers] = await Promise.all([
    withTimeout(fetchHNStories(8), 10000, []),
    withTimeout(fetchKindStories(WEB_NEWS_FEEDS, 8, true), 12000, []),
    withTimeout(fetchKindStories(WEB_BLOG_FEEDS, 6, false), 12000, []),
    withTimeout(fetchPapers('all', 30), 12000, []),
  ]);
  const allNews = [...hn, ...news].sort((a, b) => (b.ts || 0) - (a.ts || 0));
  const payload = {
    generatedAt: new Date().toISOString(),
    news: allNews.slice(0, 80),
    blogs: blogs.slice(0, 40),
    papers,
    sources: SRC_META,
    summary: null,
    meta: {},
  };
  if (!opts.skipAI) {
    payload.summary = await aiSummary(env, payload.news, papers);
  }
  return payload;
}

export async function readFeedPayload(kv) {
  try {
    const raw = await kv.get(FEEDS_KEY);
    return raw ? JSON.parse(raw) : null;
  } catch (e) { return null; }
}

// ── archive: single-writer merge + monthly segment rollover (R3/R36) ─
const ARCH_KEY = 'arch:all';
const ARCH_HOT_MAX = 4000;     // hot window served by default
const SEG_MAX = 6000;          // per-month cold segment cap
const NEWS_TTL_MS = 90 * 24 * 60 * 60 * 1000;

export async function mergeIntoArchive(kv, payload) {
  const incoming = [];
  const now = Date.now();
  (payload.news || []).forEach(s => incoming.push({ url: s.url, title: s.title, desc: (s.desc || '').slice(0, 600), src: s.src, type: 'news', topic: s.topic || '', savedAt: now }));
  (payload.blogs || []).forEach(s => incoming.push({ url: s.url, title: s.title, desc: (s.desc || '').slice(0, 600), src: s.src, type: 'blog', topic: s.topic || '', savedAt: now }));
  (payload.papers || []).forEach(p => incoming.push({ url: p.url, title: p.title, desc: (p.desc || '').slice(0, 600), src: 'arxiv', type: 'paper', topic: p.cat || 'Research', savedAt: now }));

  let existing = [];
  try { existing = JSON.parse(await kv.get(ARCH_KEY) || '[]'); } catch (e) { existing = []; }
  if (!Array.isArray(existing)) existing = [];

  const byUrl = new Map(existing.map(i => [i.url, i]));
  let added = 0;
  for (const it of incoming) {
    if (!it.url || !it.title) continue;
    if (!byUrl.has(it.url)) { byUrl.set(it.url, it); added++; }
  }
  const cutoff = now - NEWS_TTL_MS;
  let merged = [...byUrl.values()]
    .filter(i => i.type === 'news' ? (i.savedAt || 0) >= cutoff : true)
    .sort((a, b) => (b.savedAt || 0) - (a.savedAt || 0));

  // Rollover: anything past the hot window moves into a monthly segment so
  // papers/blogs are never silently dropped by the old 5,000-item cap.
  let rolled = 0;
  if (merged.length > ARCH_HOT_MAX) {
    const overflow = merged.slice(ARCH_HOT_MAX);
    merged = merged.slice(0, ARCH_HOT_MAX);
    const bySeg = {};
    overflow.forEach(i => {
      const ym = new Date(i.savedAt || now).toISOString().slice(0, 7);
      (bySeg[ym] = bySeg[ym] || []).push(i);
    });
    for (const ym of Object.keys(bySeg)) {
      const segKey = 'arch:seg:' + ym;
      let seg = [];
      try { seg = JSON.parse(await kv.get(segKey) || '[]'); } catch (e) { seg = []; }
      const segUrls = new Set(seg.map(i => i.url));
      bySeg[ym].forEach(i => { if (!segUrls.has(i.url)) { seg.push(i); rolled++; } });
      seg.sort((a, b) => (b.savedAt || 0) - (a.savedAt || 0));
      await kv.put(segKey, JSON.stringify(seg.slice(0, SEG_MAX)));
    }
  }
  await kv.put(ARCH_KEY, JSON.stringify(merged));
  return { count: merged.length, added, rolled };
}

// ── HMAC-signed links (R17) ─────────────────────────────────────────
async function hmacHex(secret, value) {
  const enc = new TextEncoder();
  const key = await crypto.subtle.importKey('raw', enc.encode(secret), { name: 'HMAC', hash: 'SHA-256' }, false, ['sign']);
  const sig = await crypto.subtle.sign('HMAC', key, enc.encode(value));
  return [...new Uint8Array(sig)].map(b => b.toString(16).padStart(2, '0')).join('');
}
export async function hmacSign(secret, value) {
  return (await hmacHex(secret, value)).slice(0, 32);
}
export async function hmacVerify(secret, value, sig) {
  if (!secret || !sig) return false;
  const want = await hmacSign(secret, value);
  if (want.length !== sig.length) return false;
  let diff = 0;
  for (let i = 0; i < want.length; i++) diff |= want.charCodeAt(i) ^ sig.charCodeAt(i);
  return diff === 0;
}

// Signed unsubscribe URL — used by send-digest + subscribe + confirm.
export async function unsubscribeUrl(env, email) {
  const base = 'https://promptai.in/unsubscribe?email=' + encodeURIComponent(email);
  const secret = env.UNSUB_SECRET || env.CRON_SECRET;
  if (!secret) return base;
  const sig = await hmacSign(secret, email.trim().toLowerCase());
  return base + '&sig=' + sig;
}

export function esc(s) {
  return (s || '').replace(/&/g, '&amp;').replace(/</g, '&lt;').replace(/>/g, '&gt;').replace(/"/g, '&quot;');
}
