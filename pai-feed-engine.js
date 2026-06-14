/* ════════════════════════════════════════════════════════════════════
   PromptAI — Shared Live-Feed Engine
   Lifted verbatim from index.html so the Google-style page pulls the
   SAME live sources (HN + RSS news + arXiv + explainer blogs), with the
   same proxy-race, quality filters, classifiers, cache and counters.
   Exposes everything under window.PAI.
   ════════════════════════════════════════════════════════════════════ */
(function () {
  'use strict';

  // ── CACHE (localStorage, TTL) ─────────────────────────
  const CACHE_TTL_NEWS   = 30 * 60 * 1000;
  const CACHE_TTL_BLOGS  = 3 * 60 * 60 * 1000;
  const CACHE_TTL_PAPERS = 6 * 60 * 60 * 1000;

  function cacheGet(key, ttl = CACHE_TTL_NEWS) {
    try {
      const raw = localStorage.getItem('pai_' + key);
      if (!raw) return null;
      const { ts, data, t } = JSON.parse(raw);
      const effectiveTtl = t || ttl;
      if (Date.now() - ts > effectiveTtl) { localStorage.removeItem('pai_' + key); return null; }
      return data;
    } catch (e) { return null; }
  }
  function cacheSet(key, data, ttl = CACHE_TTL_NEWS) {
    try { localStorage.setItem('pai_' + key, JSON.stringify({ ts: Date.now(), data, t: ttl })); } catch (e) {}
  }

  // ── AGGREGATED PAYLOAD (R1/R6) ───────────────────────────────
  // ONE request to /api/feeds replaces the old ~80-request storm. The
  // server (Pages Function + cron) aggregates every source, classifies
  // topics and adds the AI daily summary. Everything below falls back to
  // the legacy client-side fetching when the API is unreachable (local
  // preview, first deploy, KV outage).
  let _payloadPromise = null;
  function loadPayload() {
    if (_payloadPromise) return _payloadPromise;
    _payloadPromise = (async () => {
      const cached = cacheGet('apifeeds', 5 * 60 * 1000);
      if (cached) return cached;
      try {
        const ctrl = new AbortController();
        setTimeout(() => ctrl.abort(), 12000);
        const r = await fetch('/api/feeds', { signal: ctrl.signal });
        if (r.ok) {
          const d = await r.json();
          if (d && !d.offline && ((d.news && d.news.length) || (d.papers && d.papers.length))) {
            cacheSet('apifeeds', d, 5 * 60 * 1000);
            return d;
          }
        }
      } catch (e) {}
      return null;
    })();
    return _payloadPromise;
  }
  function getPayloadSync() {
    return cacheGet('apifeeds', 5 * 60 * 1000);
  }
  async function getSummary() {
    const p = await loadPayload();
    return p && p.summary ? p.summary : null;
  }
  async function getMeta() {
    const p = await loadPayload();
    return p && p.meta ? p.meta : {};
  }

  // ── DATA-QUALITY HELPERS ──────────────────────────────
  function clip(str, n = 220) {
    const s = (str || '').replace(/\s+/g, ' ').trim();
    return s.length > n ? s.slice(0, n).trim() + '…' : s;
  }
  function parseTs(str) {
    if (!str) return 0;
    const t = Date.parse(str);
    return Number.isFinite(t) ? t : 0;
  }
  function extractImage(item) {
    try {
      const encs = item.querySelectorAll('enclosure[url]');
      for (const enc of encs) {
        const u = enc.getAttribute('url') || '';
        if (/image\//i.test(enc.getAttribute('type') || '') || /\.(jpg|jpeg|png|webp|gif)(\?|$)/i.test(u)) return u;
      }
      const media = item.getElementsByTagName('media:content')[0] || item.getElementsByTagName('media:thumbnail')[0];
      if (media && media.getAttribute('url')) return media.getAttribute('url');
      const html = (item.getElementsByTagName('content:encoded')[0]?.textContent)
        || item.querySelector('content, description, summary')?.textContent || '';
      const m = html.match(/<img[^>]+src=["']([^"']+)["']/i);
      if (m) return m[1];
    } catch (e) {}
    return '';
  }
  const TOPIC_RULES = [
    ['Agents',   /\b(agent|agentic|autonomous|tool[- ]?use|multi[- ]?agent|orchestrat)\b/i],
    ['Vision',   /\b(vision|image generation|video|diffusion|midjourney|dall[- ]?e|stable diffusion|multimodal|segmentation)\b/i],
    ['Robotics', /\b(robot|robotics|embodied|drone|self[- ]?driving|autonomous vehicle|manipulation)\b/i],
    ['Policy',   /\b(regulat|policy|governance|alignment|ai safety|ethic|copyright|lawsuit|\bban\b|eu ai act)\b/i],
    ['Research', /\b(benchmark|arxiv|\bstudy\b|researchers?|state[- ]of[- ]the[- ]art|\bsota\b|fine[- ]?tun|pre[- ]?train|dataset)\b/i],
    ['Tools',    /\b(launch|release|\bapi\b|\bsdk\b|platform|plugin|available now|now available|rolls out)\b/i],
    ['LLMs',     /\b(llm|gpt|claude|gemini|llama|mistral|language model|chatbot|prompt|context window|\brag\b)\b/i],
  ];
  function classifyTopic(title, desc) {
    const text = title + ' ' + (desc || '');
    for (const [name, re] of TOPIC_RULES) { if (re.test(text)) return name; }
    return 'General';
  }
  const AI_RELEVANCE = /\b(AI|A\.I\.|artificial intelligence|machine learning|\bML\b|LLM|GPT|chatbot|deep learning|neural|openai|anthropic|claude|gemini|llama|mistral|robotics|automation|transformer|diffusion|agent|RAG|model|inference|fine[- ]?tun|dataset|benchmark|nvidia|deepmind)\b/i;
  const SPAM_NEG = /\b(casino|coupon|horoscope|betting|airdrop|forex|essay writing service|buy now|discount code|porn|viagra)\b/i;

  function passesQualityCheck(title, desc, dateStr, src) {
    if (!title || title.trim().length < 15) return false;
    if (title.length > 250) return false;
    if (/<[a-zA-Z]/.test(title)) return false;
    if (/https?:\/\//.test(title)) return false;
    if (/[{}\[\]\\;]/.test(title)) return false;
    if (/^[\d\s.,!?:-]+$/.test(title)) return false;
    if (/^\s*undefined\s*$|^\s*null\s*$/i.test(title)) return false;
    const cleanDesc = (desc || '').replace(/…$/, '').trim();
    if (cleanDesc.length > 0 && cleanDesc.length < 40) return false;
    if (desc) {
      const codeHits = (desc.match(/function\s*\(|var\s+\w|const\s+\w|let\s+\w|=>\s*{|<\/?[a-z]+>/gi) || []).length;
      if (codeHits > 2) return false;
    }
    const EVERGREEN = new Set(['anthropic','metaai','google','mitsloan','gradient','tds','medium','verge','hf','fastai','distill','interconnects','jmlr','ieee','sciencedaily','mistral','perplexity','langchain','databricks','cohere','openai','batch','msr','mit','bair']);
    if (dateStr && !EVERGREEN.has(src)) {
      try {
        const age = Date.now() - new Date(dateStr).getTime();
        const THIRTY_DAYS = 30 * 24 * 60 * 60 * 1000;
        if (age > THIRTY_DAYS) return false;
      } catch (e) {}
    }
    return true;
  }

  function parseRSS(xml, src, maxItems = 10) {
    try {
      const doc = new DOMParser().parseFromString(xml, 'text/xml');
      const items = Array.from(doc.querySelectorAll('item, entry'));
      const results = [];
      for (const item of items) {
        const title = (item.querySelector('title')?.textContent || '').trim();
        const rawDesc = item.querySelector('description, summary, content')?.textContent || '';
        const desc = clip(rawDesc.replace(/<[^>]+>/g, '').replace(/&[a-z#0-9]+;/gi, ' ').trim(), 220);
        const link = item.querySelector('link')?.textContent?.trim()
          || item.querySelector('link')?.getAttribute('href')?.trim() || '';
        const pubDate = item.querySelector('pubDate, published, updated')?.textContent?.trim() || '';
        if (!title || !link) continue;
        if (!passesQualityCheck(title, desc, pubDate, src)) continue;
        if (src !== 'arxiv' && !AI_RELEVANCE.test(title) && !AI_RELEVANCE.test(desc)) continue;
        if (SPAM_NEG.test(title + ' ' + desc)) continue;
        results.push({ src, title, url: link, date: pubDate.slice(0, 16), ts: parseTs(pubDate),
          desc, image: extractImage(item), topic: classifyTopic(title, desc) });
        if (results.length >= maxItems) break;
      }
      return results;
    } catch (e) { return []; }
  }

  // ── SOURCE HEALTH ─────────────────────────────────────
  const SOURCE_STATUS = {};
  function _failStore() { try { return JSON.parse(localStorage.getItem('pai_srcfail') || '{}'); } catch (e) { return {}; } }
  function isSourceSkipped(src) {
    const f = _failStore()[src];
    return !!(f && f.n >= 3 && (Date.now() - f.at) < 6 * 3600 * 1000);
  }
  function recordSource(src, ok) {
    SOURCE_STATUS[src] = ok ? 'ok' : 'fail';
    const store = _failStore();
    if (ok) { delete store[src]; }
    else { const f = store[src] || { n: 0 }; f.n = (f.n || 0) + 1; f.at = Date.now(); store[src] = f; }
    try { localStorage.setItem('pai_srcfail', JSON.stringify(store)); } catch (e) {}
  }

  // ── PROXY RACE ────────────────────────────────────────
  async function fetchWithProxyRace(feedUrl) {
    const isArxiv = feedUrl.includes('arxiv.org');
    const fetchers = [
      async () => {
        const ctrl = new AbortController();
        setTimeout(() => ctrl.abort(), 6000);
        try {
          const r = await fetch(`/rss-proxy?url=${encodeURIComponent(feedUrl)}`, { signal: ctrl.signal });
          if (r.ok) { const t = await r.text(); if (t && t.length > 100) return t; }
        } catch (e) {}
        return null;
      },
      ...(isArxiv ? [async () => {
        const exportUrl = feedUrl.replace('rss.arxiv.org', 'export.arxiv.org');
        const ctrl = new AbortController();
        setTimeout(() => ctrl.abort(), 6000);
        const r = await fetch(exportUrl, { signal: ctrl.signal });
        return r.ok ? r.text() : null;
      }] : []),
      async () => {
        const ctrl = new AbortController();
        setTimeout(() => ctrl.abort(), 5000);
        const r = await fetch(`https://api.allorigins.win/raw?url=${encodeURIComponent(feedUrl)}`, { signal: ctrl.signal });
        return r.text();
      },
      async () => {
        const ctrl = new AbortController();
        setTimeout(() => ctrl.abort(), 5000);
        const r = await fetch(`https://corsproxy.io/?${encodeURIComponent(feedUrl)}`, { signal: ctrl.signal });
        return r.ok ? r.text() : null;
      },
    ];
    const results = await Promise.allSettled(fetchers.map(f => f()));
    for (const r of results) {
      const val = r.status === 'fulfilled' ? r.value : null;
      if (val && val.length > 200 && (val.includes('<item') || val.includes('<entry') || val.includes('<?xml'))) return val;
    }
    return null;
  }

  // ── FETCH ONE RSS FEED ────────────────────────────────
  async function fetchRSS(feedUrl, src, maxItems = 10, ttl = CACHE_TTL_NEWS) {
    const cacheKey = src + '_' + feedUrl.slice(-20).replace(/[^a-z0-9]/gi, '_');
    const cached = cacheGet(cacheKey, ttl);
    if (cached) { recordSource(src, true); return cached; }
    if (isSourceSkipped(src)) return [];
    try {
      const xml = await fetchWithProxyRace(feedUrl);
      if (xml) {
        const results = parseRSS(xml, src, maxItems);
        if (results.length > 0) { cacheSet(cacheKey, results, ttl); recordSource(src, true); return results; }
      }
    } catch (e) {}
    try {
      const ctrl = new AbortController();
      setTimeout(() => ctrl.abort(), 9000);
      const r = await fetch(`https://api.rss2json.com/v1/api.json?rss_url=${encodeURIComponent(feedUrl)}`, { signal: ctrl.signal });
      const data = await r.json();
      if (data.status === 'ok' && data.items?.length > 0) {
        const results = data.items.map(i => {
          const title = (i.title || '').replace(/<[^>]+>/g, '').trim();
          const desc = clip((i.description || i.content || '').replace(/<[^>]+>/g, '').replace(/&[a-z#0-9]+;/gi, ' ').trim(), 220);
          return { src, title, url: i.link || i.guid || '', date: (i.pubDate || '').slice(0, 16),
            ts: parseTs(i.pubDate), desc, image: (i.thumbnail || i.enclosure?.link || ''),
            topic: classifyTopic(title, desc) };
        })
          .filter(i => i.title && i.url && passesQualityCheck(i.title, i.desc, i.date, src))
          .filter(i => src === 'arxiv' || AI_RELEVANCE.test(i.title) || AI_RELEVANCE.test(i.desc || ''))
          .filter(i => !SPAM_NEG.test(i.title + ' ' + i.desc))
          .slice(0, maxItems);
        if (results.length > 0) { cacheSet(cacheKey, results, ttl); recordSource(src, true); return results; }
      }
    } catch (e) {}
    recordSource(src, false);
    return [];
  }

  // ── FETCH: HACKER NEWS ────────────────────────────────
  async function legacyFetchHN() {
    const cached = cacheGet('hn', CACHE_TTL_NEWS);
    if (cached) return cached;
    const res = await fetch('https://hacker-news.firebaseio.com/v0/topstories.json');
    const ids = (await res.json()).slice(0, 60);
    const batches = [ids.slice(0, 20), ids.slice(20, 40), ids.slice(40, 60)];
    const items = [];
    for (const batch of batches) {
      const fetched = await Promise.all(
        batch.map(id => fetch(`https://hacker-news.firebaseio.com/v0/item/${id}.json`).then(r => r.json()).catch(() => null))
      );
      items.push(...fetched.filter(Boolean));
    }
    const aiKw = /\b(AI|LLM|GPT|claude|gemini|llama|transformer|machine learning|deep learning|neural|openai|anthropic|mistral|diffusion|RAG|fine.tun|model|agent|chatbot|copilot|inference|embedding)\b/i;
    const result = items
      .filter(i => i && i.title && (aiKw.test(i.title) || aiKw.test(i.text || '')))
      .slice(0, 7)
      .map(i => ({ src: 'hn', title: i.title, url: i.url || `https://news.ycombinator.com/item?id=${i.id}`,
        time: i.time, ts: (i.time ? i.time * 1000 : 0), score: i.score, image: '',
        topic: classifyTopic(i.title, i.text || ''),
        desc: i.text ? clip(i.text.replace(/<[^>]+>/g, ''), 200) : '' }));
    if (result.length) cacheSet('hn', result, CACHE_TTL_NEWS);
    return result;
  }

  // ── FETCH: NEWS RSS (same 9 sources as the live site) ─
  async function legacyFetchTech() {
    const feeds = [
      { url: 'https://huggingface.co/blog/feed.xml',                          src: 'hf' },
      { url: 'https://techcrunch.com/category/artificial-intelligence/feed/', src: 'tc' },
      { url: 'https://feeds.arstechnica.com/arstechnica/technology-lab',      src: 'ars' },
      { url: 'https://openai.com/news/rss.xml',                               src: 'openai' },
      { url: 'https://www.marktechpost.com/feed/',                            src: 'marktechpost' },
      { url: 'https://www.analyticsinsight.net/feed/',                        src: 'analytics' },
      { url: 'https://blog.research.google/feeds/posts/default',              src: 'google' },
      { url: 'https://www.databricks.com/blog/feed',                          src: 'databricks' },
      { url: 'https://cohere.com/blog/rss',                                   src: 'cohere' },
    ];
    const settled = await Promise.allSettled(feeds.map(f => fetchRSS(f.url, f.src, 8, CACHE_TTL_NEWS)));
    const results = [];
    settled.forEach(r => { if (r.status === 'fulfilled') results.push(...r.value); });
    return results;
  }

  // ── FETCH: EXPLAINER BLOGS (Learn) ────────────────────
  const BLOG_FEEDS = [
    { url: 'https://thegradient.pub/rss/',                 src: 'gradient' },
    { url: 'https://medium.com/feed/towards-data-science', src: 'tds' },
    { url: 'https://blog.research.google/feeds/posts/default', src: 'google' },
    { url: 'https://huggingface.co/blog/feed.xml',         src: 'hf' },
    { url: 'https://www.fast.ai/index.xml',                src: 'fastai' },
    { url: 'https://distill.pub/rss.xml',                  src: 'distill' },
    { url: 'https://blog.langchain.dev/rss/',              src: 'langchain' },
    { url: 'https://interconnects.ai/feed',               src: 'interconnects' },
  ];
  async function legacyFetchBlogs() {
    const settled = await Promise.allSettled(BLOG_FEEDS.map(f => fetchRSS(f.url, f.src, 6, CACHE_TTL_BLOGS)));
    const out = [];
    settled.forEach(r => { if (r.status === 'fulfilled') out.push(...r.value); });
    const seen = new Set();
    return out.filter(a => { if (seen.has(a.url)) return false; seen.add(a.url); return true; })
      .sort((a, b) => storyMs(b) - storyMs(a));
  }

  // ── FETCH: PAPERS (arXiv) ─────────────────────────────
  const ARXIV_FEEDS = {
    'all':   'https://rss.arxiv.org/rss/cs.AI+cs.LG+cs.CL+cs.CV',
    'cs.AI': 'https://rss.arxiv.org/rss/cs.AI',
    'cs.LG': 'https://rss.arxiv.org/rss/cs.LG',
    'cs.CL': 'https://rss.arxiv.org/rss/cs.CL',
    'cs.CV': 'https://rss.arxiv.org/rss/cs.CV',
  };
  const PAPER_CAT_MAP = {
    'cs.AI': { label: 'AI',               cls: 'cat-llm' },
    'cs.LG': { label: 'Machine Learning', cls: 'cat-ml' },
    'cs.CL': { label: 'NLP / LLM',        cls: 'cat-nlp' },
    'cs.CV': { label: 'Computer Vision',  cls: 'cat-cv' },
    'cs.RO': { label: 'Robotics',         cls: 'cat-rl' },
    'cs.NE': { label: 'Neural Nets',      cls: 'cat-ai' },
  };
  // arXiv API endpoint — primary source. The RSS feeds above are empty on
  // weekends (<skipDays> Sat/Sun), which silently emptied the Research tab;
  // the API returns the latest papers every day. RSS kept as a fallback.
  const ARXIV_Q = 'sortBy=submittedDate&sortOrder=descending&max_results=40';
  const ARXIV_API = {
    'all':   'https://export.arxiv.org/api/query?search_query=cat:cs.AI+OR+cat:cs.LG+OR+cat:cs.CL+OR+cat:cs.CV&' + ARXIV_Q,
    'cs.AI': 'https://export.arxiv.org/api/query?search_query=cat:cs.AI&' + ARXIV_Q,
    'cs.LG': 'https://export.arxiv.org/api/query?search_query=cat:cs.LG&' + ARXIV_Q,
    'cs.CL': 'https://export.arxiv.org/api/query?search_query=cat:cs.CL&' + ARXIV_Q,
    'cs.CV': 'https://export.arxiv.org/api/query?search_query=cat:cs.CV&' + ARXIV_Q,
  };
  // Fetch + parse one arXiv feed URL (RSS <item> or Atom <entry>). No cache.
  async function fetchPapersFromUrl(feedUrl) {
    try {
      const ctrl = new AbortController();
      setTimeout(() => ctrl.abort(), 9000);
      const r = await fetch(`https://api.rss2json.com/v1/api.json?rss_url=${encodeURIComponent(feedUrl)}`, { signal: ctrl.signal });
      const data = await r.json();
      if (data.status === 'ok' && data.items?.length > 0) {
        const results = data.items.slice(0, 30).map(item => {
          const cats = Array.isArray(item.categories) ? item.categories : [];
          const catMatch = cats.find(c => PAPER_CAT_MAP[c]) || cats[0] || 'cs.AI';
          const catInfo = PAPER_CAT_MAP[catMatch] || { label: 'AI', cls: 'cat-llm' };
          return {
            title: (item.title || '').replace(/\[.*?\]/g, '').replace(/<[^>]+>/g, '').trim(),
            url: item.link || item.guid || '',
            desc: (item.description || item.content || '').replace(/<[^>]+>/g, '').replace(/&[a-z#0-9]+;/gi, ' ').trim().slice(0, 300) + '…',
            cat: catInfo.label, cls: catInfo.cls,
            authors: (item.author || 'arXiv').replace(/<[^>]+>/g, '').trim(),
            date: (item.pubDate || '').slice(0, 10), src: 'arxiv',
          };
        }).filter(p => p.title && p.url);
        if (results.length) return results;
      }
    } catch (e) {}
    const xml = await fetchWithProxyRace(feedUrl);
    if (!xml) return [];
    const doc = new DOMParser().parseFromString(xml, 'text/xml');
    // arXiv serves RSS (<item>) but the API serves Atom (<entry>) — handle both
    // so a feed-format change never empties the Research tab.
    let nodes = Array.from(doc.querySelectorAll('item'));
    if (!nodes.length) nodes = Array.from(doc.querySelectorAll('entry'));
    return nodes.slice(0, 30).map(item => {
      const title = (item.querySelector('title')?.textContent || '').replace(/\[.*?\]/g, '').replace(/\s+/g, ' ').trim();
      // RSS: <link>url</link>; Atom: <link href="url"/>; fallback to <id>
      let link = (item.querySelector('link')?.textContent || '').trim();
      if (!link) { const la = item.querySelector('link'); link = (la && la.getAttribute('href')) || ''; }
      if (!link) link = (item.querySelector('id')?.textContent || '').trim();
      const descRaw = item.querySelector('description')?.textContent
        || item.querySelector('summary')?.textContent
        || item.querySelector('content')?.textContent || '';
      const desc = descRaw.replace(/<[^>]+>/g, '').replace(/&[a-z#0-9]+;/gi, ' ').trim().slice(0, 300) + '…';
      const rawCats = Array.from(item.querySelectorAll('category')).map(c => (c.getAttribute('term') || c.textContent || '').trim());
      const catMatch = rawCats.find(c => PAPER_CAT_MAP[c]) || rawCats[0] || 'cs.AI';
      const catInfo = PAPER_CAT_MAP[catMatch] || { label: catMatch, cls: 'cat-llm' };
      const authors = (item.querySelector('author name')?.textContent || item.querySelector('author')?.textContent || 'arXiv').replace(/\s+/g, ' ').trim();
      const pubDate = (item.querySelector('pubDate')?.textContent || item.querySelector('published')?.textContent || item.querySelector('updated')?.textContent || '').slice(0, 16);
      return { title, url: link, desc, cat: catInfo.label, cls: catInfo.cls, authors: authors || 'arXiv', date: pubDate, src: 'arxiv' };
    }).filter(p => p.title && p.url);
  }
  async function legacyFetchPapers(cat = 'all') {
    const cKey = 'papers_' + cat;
    const cached = cacheGet(cKey, CACHE_TTL_PAPERS);
    if (cached) return cached;
    // API first (every day), RSS feed as fallback only.
    for (const feedUrl of [ARXIV_API[cat] || ARXIV_API['all'], ARXIV_FEEDS[cat] || ARXIV_FEEDS['all']]) {
      const results = await fetchPapersFromUrl(feedUrl);
      if (results.length) { cacheSet(cKey, results, CACHE_TTL_PAPERS); return results; }
    }
    return [];
  }

  // ── PUBLIC FETCHERS — aggregated payload first, legacy fallback ──
  async function fetchHN() {
    const p = await loadPayload();
    if (p) return (p.news || []).filter(s => s.src === 'hn');
    return legacyFetchHN();
  }
  async function fetchTech() {
    const p = await loadPayload();
    if (p) return (p.news || []).filter(s => s.src !== 'hn');
    return legacyFetchTech();
  }
  async function fetchBlogs() {
    const p = await loadPayload();
    if (p && p.blogs && p.blogs.length) return p.blogs.slice().sort((a, b) => storyMs(b) - storyMs(a));
    return legacyFetchBlogs();
  }
  async function fetchPapers(cat = 'all') {
    const p = await loadPayload();
    if (p && p.papers && p.papers.length) {
      if (cat === 'all') return p.papers;
      const info = PAPER_CAT_MAP[cat];
      const want = info ? info.label : cat;
      const hits = p.papers.filter(x => x.cat === want);
      if (hits.length >= 3) return hits;
    }
    return legacyFetchPapers(cat);
  }

  // ── SOURCE METADATA ───────────────────────────────────
  const SRC_LABEL = {
    hn: 'Hacker News', arxiv: 'arXiv', tc: 'TechCrunch', mit: 'MIT News', wired: 'Wired',
    deepmind: 'DeepMind', openai: 'OpenAI', gradient: 'The Gradient', tds: 'Towards Data Science',
    analytics: 'Analytics Insight', venturebeat: 'VentureBeat', ars: 'Ars Technica', google: 'Google AI',
    anthropic: 'Anthropic', hf: 'Hugging Face', metaai: 'Meta AI', perplexity: 'Perplexity',
    mistral: 'Mistral AI', cohere: 'Cohere', databricks: 'Databricks', langchain: 'LangChain',
    wandb: 'Weights & Biases', fastai: 'fast.ai', distill: 'Distill', interconnects: 'Interconnects',
    marktechpost: 'MarkTechPost', uniteai: 'Unite.AI', msr: 'Microsoft Research', bair: 'Berkeley AI',
  };
  const SRC_DOMAIN = {
    hn: 'ycombinator.com', arxiv: 'arxiv.org', tc: 'techcrunch.com', openai: 'openai.com',
    google: 'research.google', ars: 'arstechnica.com', hf: 'huggingface.co', anthropic: 'anthropic.com',
    gradient: 'thegradient.pub', tds: 'towardsdatascience.com', fastai: 'fast.ai', distill: 'distill.pub',
    langchain: 'langchain.dev', interconnects: 'interconnects.ai', marktechpost: 'marktechpost.com',
    analytics: 'analyticsinsight.net', databricks: 'databricks.com', cohere: 'cohere.com',
    venturebeat: 'venturebeat.com', mistral: 'mistral.ai', perplexity: 'perplexity.ai', bair: 'bair.berkeley.edu',
  };
  const SRC_COLOR = {
    arxiv: '#b31b1b', hn: '#ff6600', tc: '#0a9e01', openai: '#10a37f', google: '#4285f4',
    ars: '#ff4e00', hf: '#ff9d00', anthropic: '#d97757', gradient: '#5b21b6', tds: '#334155',
    fastai: '#7c3aed', distill: '#ef4444', langchain: '#1c8a76', interconnects: '#2563eb',
    marktechpost: '#0ea5e9', analytics: '#a16207', databricks: '#ff3621', cohere: '#39594d',
    venturebeat: '#d6482b', mistral: '#fa520f', perplexity: '#20808d', bair: '#003262',
  };
  function srcLabel(src) {
    const p = getPayloadSync();
    if (p && p.sources && p.sources[src]) return p.sources[src].label;
    return SRC_LABEL[src] || (src ? src.charAt(0).toUpperCase() + src.slice(1) : 'Source');
  }
  function srcColor(src) {
    const p = getPayloadSync();
    if (p && p.sources && p.sources[src]) return p.sources[src].color;
    return SRC_COLOR[src] || '#5f6368';
  }
  function srcFavicon(src, urlGuess) {
    const p = getPayloadSync();
    const meta = p && p.sources && p.sources[src];
    const dom = (meta && meta.domain) || SRC_DOMAIN[src] || (urlGuess ? domainOf(urlGuess) : '');
    return dom ? `https://www.google.com/s2/favicons?domain=${dom}&sz=64` : '';
  }

  // ── SMALL UTILITIES ───────────────────────────────────
  function storyMs(s) {
    if (!s) return 0;
    if (s.ts && s.ts > 1e11) return s.ts;
    if (s.ts) return s.ts * 1000;
    if (s.time) return s.time * 1000;
    if (s.date) { const t = Date.parse(s.date); return Number.isFinite(t) ? t : 0; }
    return 0;
  }
  function timeAgo(ms) {
    if (!ms) return '';
    const s = Math.floor((Date.now() - ms) / 1000);
    if (s < 60) return 'just now';
    if (s < 3600) return Math.floor(s / 60) + ' min ago';
    if (s < 86400) return Math.floor(s / 3600) + ' hours ago';
    const d = Math.floor(s / 86400);
    return d === 1 ? 'Yesterday' : d + ' days ago';
  }
  function domainOf(url) {
    try { return new URL(url).hostname.replace(/^www\./, ''); } catch (e) { return ''; }
  }
  function summarizeContent(text, maxWords = 80) {
    if (!text) return '';
    const clean = text.replace(/<[^>]+>/g, ' ').replace(/https?:\/\/\S+/g, '')
      .replace(/&[a-z#0-9]+;/gi, ' ').replace(/\[.*?\]/g, '').replace(/\s+/g, ' ').trim();
    const words = clean.split(/\s+/).filter(Boolean);
    if (words.length <= maxWords) return clean;
    return words.slice(0, maxWords).join(' ') + '…';
  }
  function rankStories(stories, popular) {
    const pop = popular || {};
    return stories.slice().sort((a, b) => {
      const pa = pop[a.url] || 0, pb = pop[b.url] || 0;
      if (pb !== pa) return pb - pa;
      return storyMs(b) - storyMs(a);
    });
  }

  // ── COUNTERS (/stats Cloudflare KV) ───────────────────
  async function syncStats() {
    try {
      const already = sessionStorage.getItem('pai_visit_sent');
      const r = await fetch('/stats', already ? { method: 'GET' } : {
        method: 'POST', headers: { 'Content-Type': 'application/json' }, body: JSON.stringify({ action: 'visit', visit: true }),
      });
      const data = await r.json();
      if (!already) sessionStorage.setItem('pai_visit_sent', '1');
      return (data && !data.offline) ? data : null;
    } catch (e) { return null; }
  }
  function bumpReadCount(url) {
    try {
      fetch('/stats', { method: 'POST', headers: { 'Content-Type': 'application/json' }, body: JSON.stringify({ action: 'read', read: url || true }) }).catch(() => {});
    } catch (e) {}
  }
  // Funnel events (review #10) — fire-and-forget named counters.
  // Read back with GET /stats?events=YYYY-MM-DD.
  function event(name) {
    try {
      fetch('/stats', { method: 'POST', keepalive: true, headers: { 'Content-Type': 'application/json' }, body: JSON.stringify({ action: 'event', name }) }).catch(() => {});
    } catch (e) {}
  }
  async function subscribe(email, frequency) {
    const r = await fetch('/subscribe', {
      method: 'POST', headers: { 'Content-Type': 'application/json' },
      body: JSON.stringify(frequency ? { email, frequency } : { email }),
    });
    return r.json();
  }

  // ── EXPORT ────────────────────────────────────────────
  window.PAI = {
    fetchHN, fetchTech,
    fetchArxiv: () => fetchPapers('all'),
    fetchBlogs, fetchPapers,
    loadPayload, getSummary, getMeta,
    srcLabel, srcColor, srcFavicon, classifyTopic,
    storyMs, timeAgo, domainOf, summarizeContent, rankStories,
    syncStats, bumpReadCount, subscribe, event,
  };
})();
