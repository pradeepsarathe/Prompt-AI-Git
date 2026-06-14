/* ════════════════════════════════════════════════════════════════════
   PromptAI — Google-style UI layer
   Renders the live feeds (window.PAI) into the briefing shell.
   Account / sign-in sheet lives in pai-account.js (loaded after this).
   ════════════════════════════════════════════════════════════════════ */
(function () {
  'use strict';
  const P = window.PAI;

  // ── STATE ─────────────────────────────────────────────
  let _news = [], _papers = [], _blogs = [], _popular = {};
  let _loaded = { news: false, research: false, deepdives: false };
  let _newsTopic = 'All', _researchCat = 'all', _toolCat = 'all';
  let _view = 'home', _query = '', _prevView = 'home';
  const PAGE = { news:8, research:8, deepdives:8, tools:6 };
  let _limit = { news:PAGE.news, research:PAGE.research, deepdives:PAGE.deepdives, tools:PAGE.tools };

  // ── TOOLS DATA — loaded from tools.json (R35); this list is the
  //    embedded fallback for previews / cache misses. Each tool may carry
  //    `aff` (a ready affiliate URL) — otherwise links get ?ref=promptai (R43).
  let TOOLS = [
    { url:'https://claude.ai', dom:'claude.ai', name:'Claude (Anthropic)', desc:'Advanced reasoning, coding, analysis and long-context understanding.', cat:'llm', tag:'LLM', access:'both' },
    { url:'https://chatgpt.com', dom:'openai.com', name:'ChatGPT (OpenAI)', desc:'Multimodal assistant for text, images, voice and real-time tasks.', cat:'llm', tag:'LLM', access:'both' },
    { url:'https://gemini.google.com', dom:'gemini.google.com', name:'Gemini (Google)', desc:"Google's multimodal model with deep Workspace and search integration.", cat:'llm', tag:'LLM', access:'both' },
    { url:'https://www.perplexity.ai', dom:'perplexity.ai', name:'Perplexity', desc:'Answer engine that cites live sources for grounded research.', cat:'llm', tag:'LLM', access:'both' },
    { url:'https://github.com/features/copilot', dom:'github.com', name:'GitHub Copilot', desc:'AI pair programmer integrated into VS Code, JetBrains and more.', cat:'code', tag:'Coding', access:'paid' },
    { url:'https://www.cursor.com', dom:'cursor.com', name:'Cursor IDE', desc:'AI-native code editor built on VS Code with deep Claude/GPT integration.', cat:'code', tag:'Coding', access:'both' },
    { url:'https://replit.com', dom:'replit.com', name:'Replit Agent', desc:'Cloud IDE that builds and deploys full apps from a prompt.', cat:'code', tag:'Coding', access:'both' },
    { url:'https://www.midjourney.com', dom:'midjourney.com', name:'Midjourney v6', desc:'State-of-the-art text-to-image generation with photorealistic quality.', cat:'image', tag:'Image AI', access:'paid' },
    { url:'https://openai.com/dall-e-3', dom:'openai.com', name:'DALL·E 3', desc:"OpenAI's image model with precise text rendering inside images.", cat:'image', tag:'Image AI', access:'paid' },
    { url:'https://stability.ai', dom:'stability.ai', name:'Stable Diffusion', desc:'Open-weights image generation you can run and fine-tune locally.', cat:'image', tag:'Image AI', access:'free' },
    { url:'https://huggingface.co', dom:'huggingface.co', name:'Hugging Face', desc:'The hub for open models, datasets and ML demos.', cat:'data', tag:'Models & data', access:'free' },
    { url:'https://www.databricks.com/product/machine-learning', dom:'databricks.com', name:'Databricks + DBRX', desc:'Enterprise AI/ML platform with integrated LLM and data pipelines.', cat:'data', tag:'Data platform', access:'paid' },
    { url:'https://www.notion.so/product/ai', dom:'notion.so', name:'Notion AI', desc:'AI-enhanced workspace for notes, docs, wikis and project management.', cat:'productivity', tag:'Productivity', access:'both' },
    { url:'https://gamma.app', dom:'gamma.app', name:'Gamma', desc:'Generate polished decks, docs and sites from a single prompt.', cat:'productivity', tag:'Productivity', access:'both' },
    { url:'https://otter.ai', dom:'otter.ai', name:'Otter.ai', desc:'Live meeting transcription, summaries and action items.', cat:'productivity', tag:'Productivity', access:'both' },
    { url:'https://elevenlabs.io', dom:'elevenlabs.io', name:'ElevenLabs', desc:'Lifelike AI voice generation, dubbing and text-to-speech.', cat:'productivity', tag:'Productivity', access:'both' },
  ];
  const ACCESS = { free:{c:'free',t:'Free'}, both:{c:'both',t:'Free + Paid'}, paid:{c:'paid',t:'Paid'} };
  let TOOLS_REVIEWED = '';
  async function loadToolsJson() {
    try {
      const r = await fetch('tools.json');
      if (!r.ok) return;
      const data = await r.json();
      if (data && Array.isArray(data.tools) && data.tools.length) {
        TOOLS = data.tools;
        TOOLS_REVIEWED = data.lastReviewed || '';
        renderTools();
        const ht = $('#home-tools'); if (ht) { ht.innerHTML = ''; fill(ht, TOOLS.slice(0, 4), toolCard); }
      }
    } catch (e) { /* embedded fallback stays */ }
  }
  function toolHref(t) {
    if (t.aff) return t.aff;
    try {
      const u = new URL(t.url);
      if (!u.searchParams.has('ref')) u.searchParams.set('ref', 'promptai');
      return u.toString();
    } catch (e) { return t.url; }
  }

  // ── HELPERS ───────────────────────────────────────────
  const $ = s => document.querySelector(s);
  const el = (t, cls) => { const e = document.createElement(t); if (cls) e.className = cls; return e; };
  function favicon(dom) { return `https://www.google.com/s2/favicons?domain=${dom}&sz=64`; }
  function thumb(url, w, h) {
    if (!url) return '';
    return 'https://images.weserv.nl/?url=' + encodeURIComponent(url.replace(/^https?:\/\//, '')) + `&w=${w || 300}&h=${h || 220}&fit=cover&output=webp&q=80`;
  }
  function esc(s) { const d = document.createElement('div'); d.textContent = s || ''; return d.innerHTML; }
  // Make a card reachable + operable by keyboard (R24): real tab stop,
  // announced as a button, Enter/Space activate. aria-label = story title.
  function actionable(node, fn, label) {
    node.tabIndex = 0;
    node.setAttribute('role', 'button');
    if (label) node.setAttribute('aria-label', label);
    node.onclick = fn;
    node.onkeydown = e => {
      if (e.key === 'Enter' || e.key === ' ') { e.preventDefault(); fn(); }
    };
  }
  // Clean excerpt → '' when the source 'description' is really just a URL / junk.
  function goodExcerpt(desc, words) {
    const t = P.summarizeContent(desc, words || 34);
    if (!t) return '';
    const letters = t.replace(/[^a-z]/gi, '').length;
    if (letters < 18) return '';                                  // too little real text
    if (/^https?:|^www\.|\bwatch\?v=|^[\w.]+\.(com|org|net|io|ai)\b/i.test(t) && t.split(/\s+/).length < 7) return '';
    return t;
  }

  // ── SAVE / LIKE (R28 — backend lives in pai-account.js + /auth) ──
  function inList(kind, url) {
    try { return !!(window.paiAccount && window.paiAccount.getData()[kind] || []).some(x => x.url === url); }
    catch (e) { return false; }
  }
  window.paiToggle = function (kind, btn, s) {
    if (!window.paiAccount) { toast('Saving needs the account layer — try again in a second.'); return; }
    const on = inList(kind, s.url);
    if (on && window.paiAccount.unrecord) {
      window.paiAccount.unrecord(kind, s.url);
      toast(kind === 'saved' ? 'Removed from saved' : 'Unliked');
    } else {
      window.paiAccount.record(kind, { url: s.url, title: s.title, src: P.srcLabel(s.src) });
      toast(kind === 'saved' ? '🔖 Saved — find it in your account' : '❤️ Liked');
      if (!window.paiAccount.getSession || !window.paiAccount.getSession()) {
        // gentle nudge, once per session
        try {
          if (!sessionStorage.getItem('pai_save_nudge')) {
            sessionStorage.setItem('pai_save_nudge', '1');
            setTimeout(() => toast('Sign in to sync saves across devices'), 2800);
          }
        } catch (e) {}
      }
    }
    if (btn) syncActBtns(s.url);
    renderForYou();
  };
  const SAVE_SVG = '<svg viewBox="0 0 24 24"><path d="M17 3H7a2 2 0 0 0-2 2v16l7-3 7 3V5a2 2 0 0 0-2-2z"/></svg>';
  const LIKE_SVG = '<svg viewBox="0 0 24 24"><path d="M12 21.35l-1.45-1.32C5.4 15.36 2 12.28 2 8.5 2 5.42 4.42 3 7.5 3c1.74 0 3.41.81 4.5 2.09C13.09 3.81 14.76 3 16.5 3 19.58 3 22 5.42 22 8.5c0 3.78-3.4 6.86-8.55 11.54L12 21.35z"/></svg>';
  function actBtns(s) {
    const wrap = el('span', 'card-act');
    wrap.dataset.actUrl = s.url;
    [['saved', SAVE_SVG, 'Save'], ['liked', LIKE_SVG, 'Like']].forEach(([kind, svg, label]) => {
      const b = el('button', 'act-btn' + (inList(kind, s.url) ? ' on' : ''));
      b.dataset.kind = kind;
      b.setAttribute('aria-label', label + (inList(kind, s.url) ? 'd' : '') + ': ' + s.title);
      b.title = label;
      b.innerHTML = svg;
      b.onclick = (e) => { e.stopPropagation(); e.preventDefault(); window.paiToggle(kind, b, s); };
      b.onkeydown = (e) => { e.stopPropagation(); };
      wrap.appendChild(b);
    });
    return wrap;
  }
  function syncActBtns(url) {
    document.querySelectorAll('[data-act-url]').forEach(w => {
      if (w.dataset.actUrl !== url) return;
      w.querySelectorAll('.act-btn').forEach(b => b.classList.toggle('on', inList(b.dataset.kind, url)));
    });
    const ms = $('#m-save'), ml = $('#m-like');
    if (ms && _modalStory && _modalStory.url === url) ms.classList.toggle('on', inList('saved', url));
    if (ml && _modalStory && _modalStory.url === url) ml.classList.toggle('on', inList('liked', url));
  }

  // ── STORY CARD (Google-news list row) ─────────────────
  function storyCard(s, opts) {
    opts = opts || {};
    const c = el('article', 'card');
    const img = (s.image && !opts.noThumb)
      ? `<img class="card-thumb" src="${thumb(s.image)}" alt="" width="128" height="96" loading="lazy" onerror="this.remove()"/>` : '';
    const topic = (s.topic && s.topic !== 'General')
      ? `<span class="dot"></span><span class="topic">${esc(s.topic)}</span>` : '';
    const time = P.timeAgo(P.storyMs(s));
    c.innerHTML =
      `<div class="card-src">
         <img src="${P.srcFavicon(s.src, s.url)}" alt="" loading="lazy" onerror="this.style.visibility='hidden'"/>
         <span class="name">${esc(P.srcLabel(s.src))}</span>${topic}
       </div>
       <div class="card-row">
         <div class="card-body">
           <h3>${esc(s.title)}</h3>
           ${goodExcerpt(s.desc, 34) ? `<p class="excerpt">${esc(goodExcerpt(s.desc, 34))}</p>` : ''}
           <div class="card-meta">${time ? `<span>${time}</span>` : ''}${s.score ? `<span>▲ ${s.score}</span>` : ''}</div>
         </div>
         ${img}
       </div>`;
    actionable(c, () => openModal(s), s.title);
    const meta = c.querySelector('.card-meta');
    if (meta) meta.appendChild(actBtns(s));
    return c;
  }

  // ── VISUAL CARD (image-on-top, used by Blogs) ─────────
  function visCard(s) {
    const c = el('article', 'vis-card');
    const time = P.timeAgo(P.storyMs(s));
    c.innerHTML =
      `<img class="vis-img" src="${thumb(s.image, 520, 290)}" alt="" loading="lazy" data-direct="${esc(s.image)}" onerror="paiImgFallback(this)"/>
       <div class="vis-body">
         <div class="card-src">
           <img src="${P.srcFavicon(s.src, s.url)}" alt="" loading="lazy" onerror="this.style.visibility='hidden'"/>
           <span class="name">${esc(P.srcLabel(s.src))}</span>
           ${s.topic && s.topic !== 'General' ? `<span class="dot"></span><span class="topic">${esc(s.topic)}</span>` : ''}
         </div>
         <h3>${esc(s.title)}</h3>
         <div class="card-meta">${time ? `<span>${time}</span>` : ''}</div>
       </div>`;
    actionable(c, () => openModal(s), s.title);
    return c;
  }

  // ── LEAD CARD (always shows a proper image) ───────────
  function leadCard(s) {
    const c = el('article', 'lead');
    const media = s.image
      ? `<img class="lead-img" src="${thumb(s.image, 760, 360)}" alt="" data-direct="${esc(s.image)}" onerror="paiImgFallback(this)"/>`
      : GRAD();
    c.innerHTML =
      media +
      `<div class="lead-body">
         <div class="card-src">
           <img src="${P.srcFavicon(s.src, s.url)}" alt="" loading="lazy" onerror="this.style.visibility='hidden'"/>
           <span class="name">${esc(P.srcLabel(s.src))}</span>
           ${s.topic && s.topic !== 'General' ? `<span class="dot"></span><span class="topic">${esc(s.topic)}</span>` : ''}
         </div>
         <h2>${esc(s.title)}</h2>
         ${goodExcerpt(s.desc, 46) ? `<p class="excerpt">${esc(goodExcerpt(s.desc, 46))}</p>` : ''}
         <div class="card-meta">${P.timeAgo(P.storyMs(s)) ? `<span>${P.timeAgo(P.storyMs(s))}</span>` : ''}</div>
       </div>`;
    actionable(c, () => openModal(s), s.title);
    return c;
  }
  // Among the freshest stories, lead with the first one that has an image so
  // the big card never opens on a bare gradient.
  function pickLead(list) {
    const k = list.slice(0, 8).findIndex(s => s.image);
    return k < 0 ? 0 : k;
  }
  // <img> error chain: proxied thumbnail → original URL → branded gradient.
  window.paiImgFallback = function (img) {
    const direct = img.getAttribute('data-direct');
    if (direct) {
      img.removeAttribute('data-direct');
      img.src = direct;
      return;
    }
    if (img.classList.contains('lead-img')) img.outerHTML = GRAD();
    else img.remove();
  };
  window.GRAD = () => '<div class="lead-grad"><svg viewBox="0 0 24 24"><path d="M19 3H5a2 2 0 0 0-2 2v14a2 2 0 0 0 2 2h14a2 2 0 0 0 2-2V5a2 2 0 0 0-2-2zm-2 8H7V9h10v2zm0 4H7v-2h10v2zm-4 4H7v-2h6v2z"/></svg></div>';

  // ── PAPER CARD ────────────────────────────────────────
  function paperCard(p) {
    const c = el('article', 'card');
    c.innerHTML =
      `<div class="card-src">
         <img src="${favicon('arxiv.org')}" alt="" loading="lazy"/>
         <span class="name">arXiv</span><span class="dot"></span>
         <span class="pill ${p.cls}">${esc(p.cat)}</span>
       </div>
       <div class="card-body">
         <h3>${esc(p.title)}</h3>
         ${goodExcerpt(p.desc, 38) ? `<p class="excerpt">${esc(goodExcerpt(p.desc, 38))}</p>` : ''}
         <div class="card-meta"><span>${esc((p.authors || 'arXiv').slice(0, 60))}</span>${p.date ? `<span>${esc(p.date)}</span>` : ''}</div>
       </div>`;
    actionable(c, () => openModal({ src:'arxiv', title:p.title, url:p.url, desc:p.desc, date:p.date, topic:p.cat }), p.title);
    return c;
  }

  // ── TOOL CARD ─────────────────────────────────────────
  function toolCard(t) {
    const a = el('a', 'tool');
    a.href = toolHref(t); a.target = '_blank'; a.rel = 'noopener'; a.dataset.cat = t.cat;
    const ac = ACCESS[t.access];
    a.innerHTML =
      `<div class="tool-head">
         <img class="tool-logo" src="${favicon(t.dom)}" alt="" loading="lazy" onerror="this.style.visibility='hidden'"/>
         <span class="access ${ac.c}">${ac.t}</span>
       </div>
       <h3>${esc(t.name)}</h3>
       <p>${esc(t.desc)}</p>
       <div class="tool-foot">
         <span class="tool-tag">${esc(t.tag)}</span>
         <span class="tool-open">Open <svg viewBox="0 0 24 24" width="13" height="13" style="fill:currentColor"><path d="M14 3v2h3.59l-9.83 9.83 1.41 1.41L19 6.41V10h2V3z"/><path d="M19 19H5V5h7V3H5a2 2 0 0 0-2 2v14a2 2 0 0 0 2 2h14a2 2 0 0 0 2-2v-7h-2z"/></svg></span>
       </div>`;
    return a;
  }

  // ── RENDER LISTS ──────────────────────────────────────
  function fill(node, items, make) {
    node.innerHTML = '';
    if (!items.length) { node.innerHTML = '<div class="empty">Nothing here yet — live feeds are catching up. Refresh in a moment.</div>'; return; }
    const frag = document.createDocumentFragment();
    items.forEach(i => frag.appendChild(make(i)));
    node.appendChild(frag);
  }
  function skeleton(node, n) {
    node.innerHTML = ''; for (let i = 0; i < (n || 4); i++) { const s = el('div', 'skeleton'); node.appendChild(s); }
  }
  // Paginated fill: shows up to _limit[key] items, then a "Load more" button.
  function fillPaged(node, items, make, key, rerender) {
    node.innerHTML = '';
    if (!items.length) { node.innerHTML = '<div class="empty">Nothing here yet — live feeds are catching up. Refresh in a moment.</div>'; return; }
    const lim = _limit[key] || items.length;
    const frag = document.createDocumentFragment();
    items.slice(0, lim).forEach(i => frag.appendChild(make(i)));
    node.appendChild(frag);
    appendLoadMore(node, items.length > lim, key, rerender);
  }
  function appendLoadMore(node, show, key, rerender) {
    if (!show) return;
    const wrap = el('div', 'load-more-wrap');
    const btn = el('button', 'load-more');
    btn.innerHTML = 'Load more <svg viewBox="0 0 24 24"><path d="M7 10l5 5 5-5z"/></svg>';
    btn.onclick = () => { _limit[key] = (_limit[key] || 0) + (PAGE[key] || 10); rerender(); };
    wrap.appendChild(btn); node.appendChild(wrap);
    // infinite scroll — auto-load the next page when the button scrolls near
    if ('IntersectionObserver' in window) {
      const io = new IntersectionObserver(entries => {
        entries.forEach(en => { if (en.isIntersecting) { io.disconnect(); btn.click(); } });
      }, { rootMargin: '500px 0px' });
      io.observe(btn);
    }
  }

  // ── ARCHIVE (every story seen on the briefing lands in the local archive) ──
  function archiveStories(items, type) {
    if (!items || !items.length) return;
    try {
      const KEY = 'pai_archive';
      const cur = JSON.parse(localStorage.getItem(KEY) || '[]');
      const seen = new Set(cur.map(a => a.url));
      const now = Date.now();
      items.forEach(s => {
        if (!s.url || seen.has(s.url)) return;
        cur.unshift({ src: s.src, type, title: s.title, url: s.url,
          desc: (s.desc || '').slice(0, 300), topic: s.topic || '', savedAt: now, ts: s.ts || 0 });
        seen.add(s.url);
      });
      localStorage.setItem(KEY, JSON.stringify(cur.slice(0, 1000)));
    } catch (e) {}
  }

  // ── NEWS ──────────────────────────────────────────────
  async function loadNews() {
    skeleton($('#home-top'), 4); skeleton($('#news-list'), 5);
    let stories = [];
    try {
      const [hn, tech] = await Promise.allSettled([P.fetchHN(), P.fetchTech()]);
      if (hn.status === 'fulfilled') stories.push(...hn.value);
      if (tech.status === 'fulfilled') stories.push(...tech.value);
    } catch (e) {}
    try { const r = await fetch('/stats'); const d = await r.json(); if (d && d.popular) _popular = d.popular; } catch (e) {}
    // dedupe by url
    const seen = new Set();
    stories = stories.filter(s => s.url && !seen.has(s.url) && seen.add(s.url));
    _news = P.rankStories(stories, _popular);
    _loaded.news = true;
    archiveStories(_news, 'news');
    renderNews(); renderHome(); renderTrending(); renderForYou(); renderContinue();
    if (_query) renderSearch();
  }
  function newsTopics() {
    const counts = {}; _news.forEach(s => { const t = s.topic || 'General'; if (t !== 'General') counts[t] = (counts[t] || 0) + 1; });
    const order = ['LLMs','Agents','Vision','Robotics','Research','Tools','Policy'];
    return ['All', ...order.filter(t => counts[t])];
  }
  function renderNews() {
    // chips
    const chipBox = $('#news-chips'); chipBox.innerHTML = '';
    newsTopics().forEach(t => {
      const b = el('button', 'chip' + (t === _newsTopic ? ' active' : ''));
      b.textContent = t; b.onclick = () => { _newsTopic = t; _limit.news = PAGE.news; renderNews(); };
      chipBox.appendChild(b);
    });
    let list = _news.slice();
    if (_newsTopic !== 'All') list = list.filter(s => s.topic === _newsTopic);
    const leadBox = $('#news-lead'); leadBox.innerHTML = '';
    if (list.length) {
      const li = pickLead(list);
      leadBox.appendChild(leadCard(list[li]));
      fillPaged($('#news-list'), list.filter((_, i) => i !== li), s => storyCard(s), 'news', renderNews);
    }
    else { fillPaged($('#news-list'), list, s => storyCard(s), 'news', renderNews); }
  }

  // ── HOME ──────────────────────────────────────────────
  // "Today in 60 seconds" — the AI summary from the aggregator (R30).
  async function renderSummary() {
    const box = $('#home-summary'); if (!box) return;
    try {
      const sum = await P.getSummary();
      if (!sum || !sum.bullets || !sum.bullets.length) { box.innerHTML = ''; return; }
      box.innerHTML =
        '<div class="summary-card">' +
          '<div class="summary-k"><svg viewBox="0 0 24 24"><path d="M12 2 9.5 9.5 2 12l7.5 2.5L12 22l2.5-7.5L22 12l-7.5-2.5z"/></svg> Today in 60 seconds</div>' +
          '<ul>' + sum.bullets.map(b => '<li>' + esc(b) + '</li>').join('') + '</ul>' +
          '<div class="summary-note">AI-generated from today\u2019s headlines · updated ' + (P.timeAgo(Date.parse(sum.at)) || 'recently') + '</div>' +
        '</div>';
    } catch (e) { box.innerHTML = ''; }
  }
  function renderHome() {
    if (_news.length) {
      // live feed is up — drop the server-rendered SEO block (R19)
      const ssr = document.getElementById('ssr-home'); if (ssr) ssr.remove();
      const li = pickLead(_news);
      const lb = $('#home-lead'); lb.innerHTML = ''; lb.appendChild(leadCard(_news[li]));
      fill($('#home-top'), _news.filter((_, i) => i !== li).slice(0, 5), s => storyCard(s));
      renderNewSince();
    }
    if (_papers.length) fill($('#home-research'), _papers.slice(0, 3), paperCard);
    if (_blogs.length) fill($('#home-learn'), _blogs.slice(0, 3), s => storyCard(s));
    const ht = $('#home-tools');
    if (ht && !ht.children.length) fill(ht, TOOLS.slice(0, 4), toolCard);
  }

  // ── "N new since your last visit" (review #3) — a small return-visit cue.
  //    The stamp updates once per browser session, so reloads keep the count.
  let _newSinceShown = false;
  function renderNewSince() {
    if (_newSinceShown || !_news.length) return;
    let last = 0;
    try { last = parseInt(localStorage.getItem('pai_last_visit') || '0', 10) || 0; } catch (e) {}
    try {
      if (!sessionStorage.getItem('pai_visit_stamped')) {
        sessionStorage.setItem('pai_visit_stamped', '1');
        localStorage.setItem('pai_last_visit', String(Date.now()));
      }
    } catch (e) {}
    if (!last || Date.now() - last < 30 * 60 * 1000) return;   // same sitting — skip
    const n = _news.filter(s => P.storyMs(s) > last).length;
    if (n < 3) return;
    const sub = document.querySelector('#view-home .sec-sub');
    if (!sub || sub.querySelector('.new-since')) return;
    const chip = el('span', 'new-since');
    chip.textContent = n + ' new since your last visit';
    sub.appendChild(chip);
    _newSinceShown = true;
  }

  // ── "FOR YOU" (review #5) — visible personalization from data we already
  //    have: topics inferred from saved (×3), liked (×2) and read (×1) titles.
  function topInterests() {
    try {
      const counts = {};
      // Explicit interests chosen in the first-run picker carry the most weight
      // so "For you" works immediately, before any reading history exists.
      chosenInterests().forEach(t => { if (t && t !== 'General') counts[t] = (counts[t] || 0) + 4; });
      const d = window.paiAccount ? window.paiAccount.getData() : null;
      if (d) {
        [['saved', 3], ['liked', 2], ['history', 1]].forEach(([k, w]) =>
          (d[k] || []).slice(0, 60).forEach(x => {
            const t = P.classifyTopic(x.title || '', '');
            if (t !== 'General') counts[t] = (counts[t] || 0) + w;
          }));
      }
      return Object.entries(counts).filter(([, n]) => n >= 3)
        .sort((a, b) => b[1] - a[1]).slice(0, 3).map(([t]) => t);
    } catch (e) { return []; }
  }
  // Topics chosen in the onboarding picker (localStorage).
  function chosenInterests() {
    try { return JSON.parse(localStorage.getItem('pai_interests') || '[]') || []; } catch (e) { return []; }
  }
  // Deterministic shuffle so the "refresh" control gives a different, stable
  // ordering each press (rather than re-rendering the same first 5).
  function shuffleSeeded(arr, seed) {
    let s = seed * 9301 + 49297; const rnd = () => { s = (s * 9301 + 49297) % 233280; return s / 233280; };
    for (let m = arr.length; m;) { const i = Math.floor(rnd() * m--); const t = arr[m]; arr[m] = arr[i]; arr[i] = t; }
    return arr;
  }
  let _fyShuffle = 0;
  window.paiRefreshForYou = function () { _fyShuffle++; renderForYou(); };
  function renderForYou() {
    const panel = $('#foryou-panel'); if (!panel) return;
    const topics = topInterests();
    if (!topics.length) { panel.hidden = true; return; }
    const read = new Set((((window.paiAccount && window.paiAccount.getData()) || {}).history || []).map(x => x.url));
    let pool = _news.concat(_blogs).filter(s => topics.includes(s.topic) && !read.has(s.url));
    if (pool.length < 2) { panel.hidden = true; return; }
    panel.hidden = false;
    if (_fyShuffle > 0) pool = shuffleSeeded(pool.slice(), _fyShuffle);
    const show = pool.slice(0, 5);
    const refresh = $('#fy-refresh'); if (refresh) refresh.style.display = pool.length > 5 ? 'flex' : 'none';
    const note = $('#foryou-topics');
    if (note) note.textContent = 'Tuned to your interests · ' + topics.join(' · ');
    const box = $('#foryou-list'); if (!box) return;
    box.innerHTML = '';
    show.forEach(s => {
      const d = el('div', 'trend-item');
      d.innerHTML = '<div><h5>' + esc(s.title) + '</h5><span>' + esc(P.srcLabel(s.src)) + ' · ' + esc(s.topic || '') + '</span></div>';
      actionable(d, () => openModal(s), s.title);
      box.appendChild(d);
    });
  }

  // ── "RECENTLY READ" (retention) — re-open anything from your reading
  //    history. When the story is still in a loaded feed we reopen the full
  //    record (rich modal); otherwise a lightweight one. ──
  function findLoaded(url) {
    return _news.find(s => s.url === url) || _blogs.find(s => s.url === url) || _papers.find(p => p.url === url) || null;
  }
  function renderContinue() {
    const panel = $('#continue-panel'); if (!panel) return;
    const hist = (((window.paiAccount && window.paiAccount.getData()) || {}).history) || [];
    const seen = new Set(); const items = [];
    for (const h of hist) { if (!h || !h.url || seen.has(h.url)) continue; seen.add(h.url); items.push(h); if (items.length >= 4) break; }
    if (items.length < 2) { panel.hidden = true; return; }
    panel.hidden = false;
    const box = $('#continue-list'); if (!box) return;
    box.innerHTML = '';
    items.forEach(h => {
      const d = el('div', 'trend-item');
      d.innerHTML = '<div><h5>' + esc(h.title) + '</h5><span>' + esc(h.src || '') + '</span></div>';
      actionable(d, () => openModal(findLoaded(h.url) || { url: h.url, title: h.title, src: '', desc: '' }), h.title);
      box.appendChild(d);
    });
  }

  // ── RESEARCH ──────────────────────────────────────────
  async function loadResearch(cat) {
    _researchCat = cat || _researchCat;
    _limit.research = PAGE.research;
    renderResearchChips();
    skeleton($('#research-list'), 5);
    try { _papers = await P.fetchPapers(_researchCat); } catch (e) { _papers = []; }
    _loaded.research = true;
    archiveStories(_papers.map(p => ({ src: 'arxiv', title: p.title, url: p.url, desc: p.desc, topic: p.cat })), 'paper');
    renderResearch(); renderHome();
    if (_query) renderSearch();
  }
  function renderResearchChips() {
    const box = $('#research-chips'); box.innerHTML = '';
    const cats = [['all','All'],['cs.AI','AI'],['cs.LG','Machine Learning'],['cs.CL','NLP / LLM'],['cs.CV','Computer Vision']];
    cats.forEach(([k, label]) => {
      const b = el('button', 'chip' + (k === _researchCat ? ' active' : ''));
      b.textContent = label; b.onclick = () => loadResearch(k);
      box.appendChild(b);
    });
  }
  function renderResearch() {
    fillPaged($('#research-list'), _papers.slice(), paperCard, 'research', renderResearch);
  }

  // ── DEEP DIVES (key was "learn" pre-R34; "#learn" links still work) ──
  async function loadDeepdives() {
    skeleton($('#deepdives-list'), 5);
    try { _blogs = await P.fetchBlogs(); } catch (e) { _blogs = []; }
    _loaded.deepdives = true;
    archiveStories(_blogs, 'blog');
    renderDeepdives(); renderHome(); renderForYou();
    if (_query) renderSearch();
  }
  function renderDeepdives() {
    const box = $('#deepdives-list'); box.innerHTML = '';
    const list = _blogs.slice();
    if (!list.length) { box.innerHTML = '<div class="empty">Nothing here yet — live feeds are catching up. Refresh in a moment.</div>'; return; }
    // promote stories that ship an image; they get the visual treatment
    const ordered = [...list.filter(s => s.image), ...list.filter(s => !s.image)];
    const lim = _limit.deepdives;
    const show = ordered.slice(0, lim);
    const grid = el('div', 'vis-grid');
    show.filter(s => s.image).forEach(s => grid.appendChild(visCard(s)));
    if (grid.children.length) box.appendChild(grid);
    show.filter(s => !s.image).forEach(s => box.appendChild(storyCard(s, { noThumb: true })));
    appendLoadMore(box, ordered.length > lim, 'deepdives', renderDeepdives);
  }

  // ── TOOLS ─────────────────────────────────────────────
  function renderTools() {
    const grid = $('#tools-grid'); grid.innerHTML = '';
    const list = TOOLS.filter(t => _toolCat === 'all' || t.cat === _toolCat);
    fillPaged(grid, list, toolCard, 'tools', renderTools);
  }
  window.filterTools = function (cat, btn) {
    _toolCat = cat; _limit.tools = PAGE.tools;
    document.querySelectorAll('#tools-filter .chip').forEach(c => c.classList.remove('active'));
    btn.classList.add('active');
    renderTools();
  };

  // ── TRENDING (right rail) ─────────────────────────────
  function renderTrending() {
    const box = $('#trend-panel'); box.innerHTML = '';
    const top = _news.slice(0, 5);
    if (!top.length) { box.innerHTML = '<div class="empty" style="padding:18px">No data yet.</div>'; return; }
    top.forEach((s, i) => {
      const d = el('div', 'trend-item');
      d.innerHTML = `<span class="trend-num">${i + 1}</span><div><h5>${esc(s.title)}</h5><span>${esc(P.srcLabel(s.src))} · ${P.timeAgo(P.storyMs(s)) || ''}</span></div>`;
      actionable(d, () => openModal(s), s.title);
      box.appendChild(d);
    });
  }

  // ── SEARCH v2 (review #4) — source:/topic: operators, ranked results
  //    (title > excerpt, boosted by recency and what readers actually open),
  //    plus lightweight suggestions under the search box. ─
  function parseQuery(raw) {
    const f = { words: [], source: '', topic: '' };
    (raw || '').toLowerCase().split(/\s+/).forEach(t => {
      if (t.startsWith('source:')) f.source = t.slice(7);
      else if (t.startsWith('topic:')) f.topic = t.slice(6);
      else if (t) f.words.push(t);
    });
    return f;
  }
  function scoreItem(s, f) {
    if (f.source) {
      const label = (P.srcLabel(s.src) || '').toLowerCase();
      if ((s.src || '').toLowerCase() !== f.source && !label.replace(/\s+/g, '').includes(f.source.replace(/\s+/g, ''))) return 0;
    }
    if (f.topic) {
      const t = (s.topic || s.cat || '').toLowerCase();
      if (!t.startsWith(f.topic)) return 0;
    }
    let score = 1;
    const title = (s.title || '').toLowerCase(), desc = (s.desc || '').toLowerCase();
    for (const w of f.words) {
      if (title.includes(w)) score += 3;
      else if (desc.includes(w)) score += 1;
      else return 0;                        // AND semantics across words
    }
    const age = Date.now() - P.storyMs(s);
    if (age > 0 && age < 24 * 3600e3) score *= 1.5;          // today
    else if (age > 0 && age < 7 * 24 * 3600e3) score *= 1.2; // this week
    score += Math.min(2, (_popular[s.url] || 0) * 0.2);      // reader signal
    return score;
  }
  function rankHits(list, f) {
    return list.map(s => [scoreItem(s, f), s]).filter(x => x[0] > 0)
      .sort((a, b) => b[0] - a[0]).map(x => x[1]);
  }
  // suggestions: operator shortcuts + matching headlines, under the box
  function renderSuggest(q) {
    const box = $('#search-suggest'); if (!box) return;
    if (!q || q.length < 2 || q.includes(':')) { box.classList.remove('open'); box.innerHTML = ''; return; }
    const sugg = [];
    newsTopics().slice(1).filter(t => t.toLowerCase().startsWith(q)).slice(0, 2)
      .forEach(t => sugg.push({ label: 'topic: ' + t, q: 'topic:' + t.toLowerCase() }));
    const srcs = {};
    _news.concat(_blogs).forEach(s => { if (s.src) srcs[s.src] = P.srcLabel(s.src); });
    Object.entries(srcs).filter(([, v]) => (v || '').toLowerCase().includes(q)).slice(0, 2)
      .forEach(([k, v]) => sugg.push({ label: 'source: ' + v, q: 'source:' + k }));
    const f = parseQuery(q);
    const titles = rankHits(_news.concat(_papers, _blogs), f).slice(0, 4);
    box.innerHTML = '';
    sugg.forEach(g => {
      const b = el('button', 'sg-op'); b.type = 'button'; b.textContent = g.label;
      b.onmousedown = (ev) => { ev.preventDefault(); const si = $('#pai-search'); if (si) si.value = g.q; onSearch(g.q); };
      box.appendChild(b);
    });
    titles.forEach(s => {
      const b = el('button', 'sg-item'); b.type = 'button';
      b.innerHTML = '<svg viewBox="0 0 24 24" width="15" height="15" style="fill:var(--text-3);flex:none"><path d="M15.5 14h-.79l-.28-.27a6.5 6.5 0 1 0-.7.7l.27.28v.79l5 4.99L20.49 19l-4.99-5zm-6 0A4.5 4.5 0 1 1 14 9.5 4.49 4.49 0 0 1 9.5 14z"/></svg><span>' + esc(s.title) + '</span>';
      b.onmousedown = (ev) => { ev.preventDefault(); box.classList.remove('open'); openModal(s); };
      box.appendChild(b);
    });
    box.classList.toggle('open', !!(sugg.length || titles.length));
  }
  window.onSearch = function (q) {
    _query = (q || '').trim().toLowerCase();
    renderSuggest(_query);
    if (_query) {
      try {
        if (!sessionStorage.getItem('pai_ev_search')) { sessionStorage.setItem('pai_ev_search', '1'); P.event && P.event('search_used'); }
      } catch (e) {}
      if (_view !== 'search') _prevView = _view;
      showView('search');
      // make sure every dataset is loaded so results are complete
      if (!_loaded.research) loadResearch(_researchCat);
      if (!_loaded.deepdives) loadDeepdives();
      renderSearch();
    } else if (_view === 'search') {
      go(_prevView || 'home');
    }
  };
  function searchGroup(title, items, make, frag) {
    if (!items.length) return 0;
    const d = el('div', 'sec-divider');
    d.innerHTML = `<div class="sec-row"><h2>${title}</h2><div class="line"></div><span style="font-size:0.8rem;color:var(--text-3)">${items.length} result${items.length === 1 ? '' : 's'}</span></div>`;
    frag.appendChild(d);
    items.slice(0, 6).forEach(i => frag.appendChild(make(i)));
    return items.length;
  }
  function renderSearch() {
    const box = $('#search-list'); if (!box) return;
    const label = $('#search-q'); if (label) label.textContent = _query;
    box.innerHTML = '';
    if (!_query) return;
    const frag = document.createDocumentFragment();
    let total = 0;
    const f = parseQuery(_query);
    total += searchGroup('News', rankHits(_news, f), s => storyCard(s), frag);
    total += searchGroup('Research papers', rankHits(_papers, f), paperCard, frag);
    total += searchGroup('Deep dives & explainers', rankHits(_blogs, f), s => storyCard(s, { noThumb: true }), frag);
    const toolHits = (f.source || f.topic || !f.words.length) ? [] : TOOLS.filter(t => {
      const txt = (t.name + ' ' + t.desc + ' ' + t.tag).toLowerCase();
      return f.words.every(w => txt.includes(w));
    });
    if (toolHits.length) {
      const d = el('div', 'sec-divider');
      d.innerHTML = `<div class="sec-row"><h2>Tools</h2><div class="line"></div><span style="font-size:0.8rem;color:var(--text-3)">${toolHits.length} result${toolHits.length === 1 ? '' : 's'}</span></div>`;
      frag.appendChild(d);
      const grid = el('div', 'tools-grid');
      toolHits.slice(0, 6).forEach(t => grid.appendChild(toolCard(t)));
      frag.appendChild(grid);
      total += toolHits.length;
    }
    box.appendChild(frag);
    const loading = !_loaded.news || !_loaded.research || !_loaded.deepdives;
    if (!total) {
      box.innerHTML = loading
        ? '<div class="empty">Searching the live feeds…</div>'
        : '<div class="empty">No matches for “' + esc(_query) + '”. Try a shorter keyword, or narrow with <code>topic:agents</code> / <code>source:techcrunch</code> — search covers news, papers, blogs and tools currently in the feed.</div>';
    }
  }
  window.clearSearch = function () {
    const si = $('#pai-search'); if (si) si.value = '';
    onSearch('');
  };

  // ── NAV ───────────────────────────────────────────────
  const VIEWS = ['home', 'news', 'research', 'deepdives', 'tools'];
  const VIEW_ALIASES = { learn: 'deepdives' }; // old links keep working
  function showView(view) {
    _view = view;
    document.querySelectorAll('.view').forEach(v => v.classList.remove('active'));
    const target = $('#view-' + view); if (target) target.classList.add('active');
    document.querySelectorAll('.tab[data-nav]').forEach(r => {
      const active = r.dataset.nav === view;
      r.classList.toggle('active', active);
      if (active) r.setAttribute('aria-current', 'true');
      else r.removeAttribute('aria-current');
    });
    // keep the active tab visible on narrow screens (no scrollIntoView — it
    // can scroll ancestors; nudge the tab strip's own scrollLeft instead)
    const tabsEl = $('#tabs'), at = document.querySelector('.tab.active[data-nav]');
    if (tabsEl && at) {
      const want = at.offsetLeft - 60;
      if (want < tabsEl.scrollLeft || at.offsetLeft + at.offsetWidth > tabsEl.scrollLeft + tabsEl.clientWidth) {
        tabsEl.scrollLeft = Math.max(0, want);
      }
    }
    window.scrollTo({ top: 0, behavior: 'auto' });
  }
  // R27: each section lives at its own URL (#news, #research …) so Back
  // works, sections are linkable, and a refresh keeps your place.
  let _navFromUrl = false;
  window.go = function (view) {
    // navigating away from search clears the query
    if (_query) { _query = ''; const si = $('#pai-search'); if (si) si.value = ''; }
    showView(view);
    if (view === 'research' && !_loaded.research) loadResearch('all');
    if (view === 'deepdives' && !_loaded.deepdives) loadDeepdives();
    if (view === 'tools') renderTools();
    if (!_navFromUrl && VIEWS.includes(view)) {
      const target = view === 'home'
        ? location.pathname + location.search
        : '#' + view;
      const current = location.hash || '';
      if ((view === 'home' && current) || (view !== 'home' && current !== target)) {
        try { history.pushState(null, '', target); } catch (e) { location.hash = view; }
      }
    }
  };
  function applyLocation() {
    let h = (location.hash || '').replace('#', '');
    h = VIEW_ALIASES[h] || h;
    const v = VIEWS.includes(h) ? h : 'home';
    if (v !== _view) { _navFromUrl = true; go(v); _navFromUrl = false; }
  }
  window.addEventListener('popstate', applyLocation);
  window.addEventListener('hashchange', applyLocation);
  window.toggleRail = function () {};

  // ── MODAL ─────────────────────────────────────────────
  let _modalUrl = '';
  let _modalStory = null;
  let _modalOpener = null; // focus returns here on close (a11y)
  // "Up next" — rank the loaded feeds against the story you're reading so the
  // modal can offer 2-3 related reads. Scores topic + source + title-keyword
  // overlap + recency, de-prioritises what you've already opened, and
  // backfills with the freshest news so the rail is never half-empty.
  function relatedStories(cur, n) {
    n = n || 3;
    const read = new Set((((window.paiAccount && window.paiAccount.getData()) || {}).history || []).map(x => x.url));
    const tok = t => new Set((t || '').toLowerCase().match(/[a-z]{4,}/g) || []);
    const curTok = tok(cur.title);
    const curTopic = cur.topic || cur.cat || '';
    const pool = _news.concat(_blogs, _papers);
    const seen = new Set([cur.url]);
    const scored = [];
    for (const s of pool) {
      if (!s.url || seen.has(s.url)) continue;
      seen.add(s.url);
      let score = 0;
      const sTopic = s.topic || s.cat || '';
      if (curTopic && sTopic && curTopic === sTopic) score += 4;
      if (cur.src && s.src && cur.src === s.src) score += 2;
      let overlap = 0; for (const w of tok(s.title)) if (curTok.has(w)) overlap++;
      score += Math.min(3, overlap);
      const age = Date.now() - P.storyMs(s);
      if (age > 0 && age < 24 * 3600e3) score += 1.5;
      else if (age > 0 && age < 7 * 24 * 3600e3) score += 0.8;
      score += Math.min(1.5, (_popular[s.url] || 0) * 0.15);
      if (read.has(s.url)) score -= 1.2;          // seen it — rank lower, don't drop
      if (score > 0.4) scored.push([score, s]);
    }
    scored.sort((a, b) => b[0] - a[0]);
    const top = scored.slice(0, n).map(x => x[1]);
    const have = new Set(top.map(x => x.url).concat([cur.url]));
    // backfill pass 1: freshest UNREAD news. pass 2 (last resort): any fresh
    // news incl. already-read — a returning reader still gets a full rail.
    for (const allowRead of [false, true]) {
      if (top.length >= n) break;
      for (const s of _news) {
        if (top.length >= n) break;
        if (!s.url || have.has(s.url)) continue;
        if (!allowRead && read.has(s.url)) continue;
        have.add(s.url); top.push(s);
      }
    }
    return top;
  }
  function renderModalNext(cur) {
    const box = $('#m-next'); if (!box) return;
    const rel = relatedStories(cur, 3);
    if (rel.length < 2) { box.style.display = 'none'; box.innerHTML = ''; return; }
    box.style.display = 'block';
    box.innerHTML = '<div class="m-next-h">Up next</div>';
    const list = el('div', 'm-next-list');
    rel.forEach(s => {
      const d = el('div', 'm-next-item');
      const topic = (s.topic && s.topic !== 'General') ? ' · ' + esc(s.topic) : (s.cat ? ' · ' + esc(s.cat) : '');
      d.innerHTML = '<img src="' + P.srcFavicon(s.src, s.url) + '" alt="" loading="lazy" onerror="this.style.visibility=\'hidden\'"/>' +
        '<div><h5>' + esc(s.title) + '</h5><span>' + esc(P.srcLabel(s.src)) + topic + '</span></div>';
      actionable(d, () => { P.event && P.event('next_story'); openModal(s); }, s.title);
      list.appendChild(d);
    });
    box.appendChild(list);
  }
  window.openModal = function (s) {
    _modalOpener = document.activeElement;
    _modalUrl = s.url;
    _modalStory = s;
    P.bumpReadCount(s.url);
    P.event && P.event('modal_open');
    if (window.paiAccount) window.paiAccount.record('history', { url: s.url, title: s.title, src: P.srcLabel(s.src) });
    $('#m-src').innerHTML = `<img src="${P.srcFavicon(s.src, s.url)}" alt="" onerror="this.style.visibility='hidden'"/> ${esc(P.srcLabel(s.src))}`;
    const pill = $('#m-pill');
    if (s.topic && s.topic !== 'General') { pill.style.display = 'inline-block'; pill.className = 'pill cat-ai'; pill.textContent = s.topic; }
    else pill.style.display = 'none';
    $('#m-title').textContent = s.title;
    const time = P.timeAgo(P.storyMs(s));
    $('#m-meta').innerHTML = (s.score ? `<span>▲ ${s.score} points</span>` : '') + (time ? `<span>🕐 ${time}</span>` : '') + `<span>🌐 ${P.domainOf(s.url)}</span>`;
    $('#m-text').innerHTML = goodExcerpt(s.desc, 80) ? esc(goodExcerpt(s.desc, 80)) : 'Open the original article to read the full story on the source site.';
    $('#m-note').innerHTML = `Summary from <strong>${P.domainOf(s.url)}</strong> · open the source for the full article.`;
    $('#m-read').href = s.url;
    const su = encodeURIComponent(s.url), st = encodeURIComponent(s.title + ' via @promptai_in');
    $('#m-x').href = `https://twitter.com/intent/tweet?url=${su}&text=${st}`;
    $('#m-li').href = `https://www.linkedin.com/sharing/share-offsite/?url=${su}`;
    $('#m-copy').textContent = '🔗 Copy';
    // save / like state (R28)
    const ms = $('#m-save'), ml = $('#m-like');
    if (ms) { ms.classList.toggle('on', inList('saved', s.url)); ms.onclick = () => window.paiToggle('saved', ms, s); }
    if (ml) { ml.classList.toggle('on', inList('liked', s.url)); ml.onclick = () => window.paiToggle('liked', ml, s); }
    // "Explain this paper" — AI explainer for arXiv items (R30)
    const ex = $('#m-explain');
    if (ex) {
      ex.innerHTML = '';
      ex.style.display = 'none';
      if (s.src === 'arxiv') {
        ex.style.display = 'block';
        const b = el('button', 'explain-btn');
        b.innerHTML = '✨ Explain this paper';
        b.onclick = () => explainPaper(s, ex);
        ex.appendChild(b);
      }
    }
    loadModalSummary(s); // ~100-word AI summary for any item (news, research, blogs…)
    renderModalNext(s);  // "Up next" — related reads to keep the session going
    renderContinue();    // reflect this open in the "Recently read" rail
    $('#modal').classList.add('open'); document.body.style.overflow = 'hidden';
    $('#modal').scrollTop = 0; // switching from an "Up next" pick starts at the top
    const x = document.querySelector('#modal .modal-x'); if (x) x.focus();
  };
  // Auto-load a ~100-word AI summary into the modal. Falls back silently
  // to the RSS excerpt when AI is unavailable, offline, or rate-limited.
  async function loadModalSummary(s) {
    if (!s || !s.url || !/^https?:/.test(s.url)) return;
    const note = $('#m-note');
    const fallbackNote = `Summary from <strong>${P.domainOf(s.url)}</strong> · open the source for the full article.`;
    if (note) note.innerHTML = `✨ Writing a quick summary… · <strong>${P.domainOf(s.url)}</strong>`;
    try {
      const r = await fetch('/api/summarize', {
        method: 'POST', headers: { 'Content-Type': 'application/json' },
        body: JSON.stringify({ url: s.url, title: s.title, desc: s.desc || '' }),
      });
      const d = await r.json().catch(() => null);
      if (_modalUrl !== s.url) return; // a different story was opened meanwhile
      if (d && d.summary) {
        $('#m-text').innerHTML = esc(d.summary);
        if (note) note.innerHTML = `✨ AI summary — may miss nuance · source: <strong>${P.domainOf(s.url)}</strong>`;
      } else if (note) {
        note.innerHTML = fallbackNote;
      }
    } catch (e) {
      if (_modalUrl === s.url && note) note.innerHTML = fallbackNote;
    }
  }
  async function explainPaper(s, box) {
    P.event && P.event('explain_click');
    box.innerHTML = '<div class="explain-loading">Reading the abstract…</div>';
    try {
      const r = await fetch('/api/explain', {
        method: 'POST', headers: { 'Content-Type': 'application/json' },
        body: JSON.stringify({ url: s.url, title: s.title, desc: s.desc || '' }),
      });
      const d = await r.json();
      if (d && d.explanation) {
        const html = esc(d.explanation)
          .replace(/(What it does:|Why it matters:|In plain English:)/g, '<strong>$1</strong>')
          .replace(/\n+/g, '<br/>');
        box.innerHTML = '<div class="explain-out">' + html + '<div class="explain-note">AI-generated from the abstract — check the paper for details.</div></div>';
      } else {
        box.innerHTML = '<div class="explain-loading">Explainer isn\u2019t available right now — open the paper below.</div>';
      }
    } catch (e) {
      box.innerHTML = '<div class="explain-loading">Explainer isn\u2019t available right now — open the paper below.</div>';
    }
  }
  window.closeModal = function () {
    $('#modal').classList.remove('open'); document.body.style.overflow = '';
    if (_modalOpener && _modalOpener.focus) { try { _modalOpener.focus(); } catch (e) {} }
    _modalOpener = null;
  };
  window.copyLink = function () {
    navigator.clipboard.writeText(_modalUrl).then(() => { $('#m-copy').textContent = '✓ Copied'; setTimeout(() => $('#m-copy').textContent = '🔗 Copy', 1800); }).catch(() => toast('Copy failed'));
  };
  document.addEventListener('keydown', e => { if (e.key === 'Escape') { closeModal(); window.closeSheet && window.closeSheet(); $('#theme-menu').classList.remove('open'); $('#sub-menu').classList.remove('open'); $('#lang-menu').classList.remove('open'); const sg = $('#search-suggest'); if (sg) sg.classList.remove('open'); } });
  // "/" focuses the search box from anywhere (power-user shortcut). Ignored
  // while typing in a field, and won't fire with a modifier held.
  document.addEventListener('keydown', e => {
    if (e.key !== '/' || e.metaKey || e.ctrlKey || e.altKey) return;
    const t = e.target, tag = t && t.tagName;
    if (tag === 'INPUT' || tag === 'TEXTAREA' || (t && t.isContentEditable)) return;
    const s = $('#pai-search'); if (s) { e.preventDefault(); s.focus(); s.select && s.select(); }
  });

  // ── NEWSLETTER ────────────────────────────────────────
  // ── FOCUS TRAP (R25) — Tab cycles inside open modal / sheet ──
  function trapFocus(e) {
    if (e.key !== 'Tab') return;
    const containers = [];
    const m = $('#modal'); if (m && m.classList.contains('open')) containers.push(m.querySelector('.modal'));
    const sh = $('#sheet'); if (sh && sh.classList.contains('open')) containers.push(sh);
    const box = containers[containers.length - 1];
    if (!box) return;
    const focusables = [...box.querySelectorAll('a[href], button:not([disabled]), input, select, textarea, [tabindex]:not([tabindex="-1"])')]
      .filter(n => n.offsetParent !== null);
    if (!focusables.length) return;
    const first = focusables[0], last = focusables[focusables.length - 1];
    if (e.shiftKey && (document.activeElement === first || !box.contains(document.activeElement))) {
      e.preventDefault(); last.focus();
    } else if (!e.shiftKey && (document.activeElement === last || !box.contains(document.activeElement))) {
      e.preventDefault(); first.focus();
    }
  }
  document.addEventListener('keydown', trapFocus, true);

  window.doSubscribe = function (e) {
    e.preventDefault();
    const email = $('#promo-email').value.trim();
    if (!email) return false;
    const pf = document.querySelector('input[name="promo-freq"]:checked');
    const freq = pf ? pf.value : 'weekly';
    toast('Subscribing…');
    P.event && P.event('subscribe_submit');
    P.subscribe(email, freq).then(r => {
      if (r && (r.ok || r.success || r.status === 'ok' || r.subscribed)) {
        P.event && P.event('subscribe_success');
        toast(r.message || '✓ Subscribed! Check your inbox.');
      }
      else toast('✓ Thanks — you’re on the list.');
      $('#promo-email').value = '';
    }).catch(() => toast('Saved — we’ll be in touch.'));
    return false;
  };

  // ── LANGUAGE (Google Translate driven by our popover) ─────────
  window.toggleLangMenu = function (e) {
    e.stopPropagation();
    const m = $('#lang-menu'); m.classList.toggle('open');
    $('#theme-menu').classList.remove('open'); $('#sub-menu').classList.remove('open');
  };
  document.addEventListener('click', e => { if (!e.target.closest('#lang-menu') && !e.target.closest('#lang-btn')) $('#lang-menu').classList.remove('open'); });
  window.setLang = function (code) {
    try { localStorage.setItem('pai_lang', code); } catch (e) {}
    document.querySelectorAll('.lang-opt').forEach(o => o.classList.toggle('active', o.dataset.lang === code));
    $('#lang-menu') && $('#lang-menu').classList.remove('open');
    if (window.paiSetLang) window.paiSetLang(code); else location.reload();
  };
  function markActiveLang() {
    let cur = 'en'; try { cur = localStorage.getItem('pai_lang') || 'en'; } catch (e) {}
    document.querySelectorAll('.lang-opt').forEach(o => o.classList.toggle('active', o.dataset.lang === cur));
  }

  window.toggleThemeMenu = function (e) { e.stopPropagation(); $('#theme-menu').classList.toggle('open'); $('#sub-menu').classList.remove('open'); $('#lang-menu').classList.remove('open'); };
  document.addEventListener('click', e => { if (!e.target.closest('#theme-menu') && !e.target.closest('[onclick*="toggleThemeMenu"]')) $('#theme-menu').classList.remove('open'); });

  // ── SUBSCRIBE POPOVER (top bar) ────────────────────
  window.toggleSubscribe = function (e) {
    e.stopPropagation();
    const m = $('#sub-menu'); m.classList.toggle('open'); $('#theme-menu').classList.remove('open');
    if (m.classList.contains('open')) { const i = $('#top-email'); if (i) setTimeout(() => i.focus(), 30); }
  };
  document.addEventListener('click', e => { if (!e.target.closest('#sub-menu') && !e.target.closest('#subscribe-btn')) $('#sub-menu').classList.remove('open'); });
  window.doTopSubscribe = function (e) {
    e.preventDefault();
    const input = $('#top-email'), email = (input && input.value || '').trim();
    if (!email) return false;
    const fr = document.querySelector('input[name="sub-freq"]:checked');
    const freq = fr ? fr.value : 'weekly';
    P.event && P.event('subscribe_submit');
    P.subscribe(email, freq).then(r => {
      if (r && (r.ok || r.success || r.status === 'ok' || r.subscribed)) {
        P.event && P.event('subscribe_success');
        toast(r.message || '✓ Subscribed! Check your inbox.');
      }
      else toast('✓ Thanks — you’re on the list.');
      if (input) input.value = '';
    }).catch(() => toast('Saved — we’ll be in touch.'));
    $('#sub-menu').classList.remove('open');
    return false;
  };
  // R29: light themes + dark + follow-system (default = follow system)
  function systemDark() { try { return matchMedia('(prefers-color-scheme: dark)').matches; } catch (e) { return false; } }
  function applyTheme(t) {
    const eff = (!t || t === 'auto') ? (systemDark() ? 'dark' : 'default') : t;
    if (eff === 'default') document.documentElement.removeAttribute('data-theme');
    else document.documentElement.setAttribute('data-theme', eff);
    document.querySelectorAll('.theme-opt').forEach(o => o.classList.toggle('active', (o.dataset.theme || '') === t));
  }
  window.applyPaiTheme = applyTheme;
  window.setTheme = function (t) {
    try { localStorage.setItem('pai_theme', t); } catch (e) {}
    applyTheme(t);
  };
  try {
    matchMedia('(prefers-color-scheme: dark)').addEventListener('change', () => {
      let s = 'auto'; try { s = localStorage.getItem('pai_theme') || 'auto'; } catch (e) {}
      if (s === 'auto') applyTheme('auto');
    });
  } catch (e) {}

  // mobile: magnifier button reveals the search bar under the top bar
  window.toggleMobileSearch = function (e) {
    if (e) e.stopPropagation();
    const tb = document.querySelector('.topbar'); if (!tb) return;
    tb.classList.toggle('search-open');
    if (tb.classList.contains('search-open')) { const i = $('#pai-search'); if (i) setTimeout(() => i.focus(), 30); }
  };

  // ── TOAST ─────────────────────────────────────────────
  let _toastT;
  function toast(msg) { const t = $('#toast'); t.textContent = msg; t.classList.add('show'); clearTimeout(_toastT); _toastT = setTimeout(() => t.classList.remove('show'), 2600); }
  window.toast = toast;

  // ── FIRST-RUN INTEREST PICKER (review #5/#10) ─────────
  // Shown once. Seeds "For you" instantly so new readers don't face a cold,
  // un-personalised feed. Choices persist in localStorage ('pai_interests').
  const ONB_TOPICS = ['LLMs', 'Agents', 'Vision', 'Robotics', 'Research', 'Tools', 'Policy'];
  let _onbSel = [];
  function paiMaybeOnboard() {
    let done = false, has = false;
    try {
      done = !!localStorage.getItem('pai_onboarded');
      has = (JSON.parse(localStorage.getItem('pai_interests') || '[]') || []).length > 0;
    } catch (e) {}
    if (done || has) return;
    const box = $('#onb-topics'); if (!box) return;
    box.innerHTML = '';
    _onbSel = [];
    ONB_TOPICS.forEach(t => {
      const b = el('button', 'onb-chip'); b.type = 'button'; b.textContent = t;
      b.setAttribute('aria-pressed', 'false');
      b.onclick = () => {
        const on = b.classList.toggle('sel');
        b.setAttribute('aria-pressed', on ? 'true' : 'false');
        if (on) _onbSel.push(t); else _onbSel = _onbSel.filter(x => x !== t);
        const save = $('#onb-save'); if (save) save.disabled = _onbSel.length === 0;
      };
      box.appendChild(b);
    });
    const save = $('#onb-save'); if (save) save.disabled = true;
    $('#onboard').classList.add('open');
  }
  function paiCloseOnboard() {
    try { localStorage.setItem('pai_onboarded', '1'); } catch (e) {}
    const o = $('#onboard'); if (o) o.classList.remove('open');
  }
  window.paiSkipOnboard = function () { paiCloseOnboard(); P.event && P.event('onboard_skip'); };
  window.paiSaveOnboard = function () {
    try { localStorage.setItem('pai_interests', JSON.stringify(_onbSel)); } catch (e) {}
    paiCloseOnboard();
    P.event && P.event('onboard_save');
    renderForYou();
    if (_onbSel.length) toast('✨ Your feed is tuned to ' + _onbSel.slice(0, 3).join(', '));
  };

  // ── READING STREAK (review #10) — a quiet return cue. ─
  function renderStreak() {
    try {
      const today = new Date().toISOString().slice(0, 10);
      let s = {}; try { s = JSON.parse(localStorage.getItem('pai_streak') || '{}') || {}; } catch (e) {}
      if (s.last !== today) {
        const y = new Date(Date.now() - 864e5).toISOString().slice(0, 10);
        s.n = (s.last === y) ? (s.n || 0) + 1 : 1;
        s.last = today;
        try { localStorage.setItem('pai_streak', JSON.stringify(s)); } catch (e) {}
      }
      if ((s.n || 0) >= 2) {
        const panel = $('#stats-panel');
        if (panel && !panel.querySelector('.streak-row')) {
          const row = el('div', 'stat-row streak-row');
          row.innerHTML = '<span class="k">Your reading streak</span><span class="v">' + s.n + ' day' + (s.n === 1 ? '' : 's') + '</span>';
          panel.insertBefore(row, panel.firstChild);
        }
      }
    } catch (e) {}
  }

  // ── COUNTERS ──────────────────────────────────────────
  function fmt(n) { return n >= 1e6 ? (n / 1e6).toFixed(1) + 'M' : n >= 1e3 ? (n / 1e3).toFixed(1) + 'k' : String(n); }
  // Content stats, not vanity visitor counters (R33).
  async function loadStats() {
    // still record the visit (ops data) — we just don't display it anymore
    try { P.syncStats(); } catch (e) {}
    const weekAgo = Date.now() - 7 * 24 * 60 * 60 * 1000;
    let stories = 0, papers = 0;
    try {
      const r = await fetch('/archive-data?limit=4000');
      const d = await r.json();
      if (d && !d.offline && Array.isArray(d.items)) {
        d.items.forEach(i => {
          if ((i.savedAt || 0) >= weekAgo) {
            if (i.type === 'paper') papers++; else stories++;
          }
        });
      }
    } catch (e) {}
    if (!stories && !papers) {
      // preview / cold KV — fall back to what's loaded in this session
      stories = _news.length + _blogs.length; papers = _papers.length;
    }
    let sources = 20;
    try {
      const p = await P.loadPayload();
      if (p && p.sources) sources = Object.keys(p.sources).length;
    } catch (e) {}
    const set = (id, v) => { const n = $(id); if (n) n.textContent = v; };
    if (stories) set('#stat-stories', fmt(stories));
    if (papers) set('#stat-papers', fmt(papers));
    set('#stat-sources', sources + '+');
    // honest social proof on subscribe forms (R32) — only when real
    try {
      const meta = await P.getMeta();
      if (meta && meta.subscribers >= 100) {
        document.querySelectorAll('[data-social-proof]').forEach(n => {
          n.textContent = `Join ${fmt(meta.subscribers)}+ readers · No spam. Unsubscribe anytime.`;
        });
      }
    } catch (e) {}
  }

  // ── RAIL SUBSCRIBE (mirrors the right-rail promo; always visible) ──
  window.doRailSubscribe = function (e) {
    e.preventDefault();
    const input = $('#rail-email');
    const email = (input && input.value || '').trim();
    if (!email) return false;
    P.event && P.event('subscribe_submit');
    P.subscribe(email).then(r => {
      if (r && (r.ok || r.success || r.status === 'ok' || r.subscribed)) {
        P.event && P.event('subscribe_success');
        toast(r.message || '✓ Subscribed! Check your inbox.');
      }
      else toast('✓ Thanks — you’re on the list.');
      if (input) input.value = '';
    }).catch(() => toast('Saved — we’ll be in touch.'));
    return false;
  };

  // ── BOOT ──────────────────────────────────────────────
  function boot() {
    let saved = 'auto';
    try { saved = localStorage.getItem('pai_theme') || 'auto'; } catch (e) {}
    applyPaiTheme(saved);
    markActiveLang();
    // hide search suggestions when the box loses focus
    const si0 = $('#pai-search');
    if (si0) si0.addEventListener('blur', () => setTimeout(() => { const b = $('#search-suggest'); if (b) b.classList.remove('open'); }, 150));
    // rail sources
    const railSrc = $('#rail-sources');
    if (railSrc) [['tc','techcrunch.com'],['openai','openai.com'],['hf','huggingface.co'],['google','research.google'],['arxiv','arxiv.org'],['hn','ycombinator.com']]
      .forEach(([src, dom]) => {
        const d = el('div', 'rail-src');
        d.innerHTML = `<img src="${favicon(dom)}" alt="" onerror="this.style.visibility='hidden'"/> ${P.srcLabel(src)}`;
        railSrc.appendChild(d);
      });
    renderTools();
    loadToolsJson(); // R35 — tools.json with lastReviewed dates
    renderSummary(); // R30 — "Today in 60 seconds"
    renderStreak();  // review #10 — return-visit streak cue
    renderContinue(); // "Recently read" rail
    paiMaybeOnboard(); // review #5/#10 — first-run interest picker
    // honor a #view hash (links from education.html / archive.html land on the right tab)
    let h = (location.hash || '').replace('#', '');
    h = VIEW_ALIASES[h] || h;
    if (VIEWS.includes(h)) go(h);
    // apply a search handed off from another page's top-bar search
    try {
      const pq = sessionStorage.getItem('pai_pending_search');
      if (pq) { sessionStorage.removeItem('pai_pending_search'); const si = $('#pai-search'); if (si) si.value = pq; onSearch(pq); }
    } catch (e) {}
    // honour a ?q= query param so the homepage SearchAction (schema.org) and
    // shared search URLs run search in-app (one unified search surface).
    try {
      const qp = new URLSearchParams(location.search).get('q');
      if (qp) { const si = $('#pai-search'); if (si) si.value = qp; onSearch(qp); }
    } catch (e) {}
    loadNews();
    loadStats();
    // home sections load as you scroll toward them (research → blogs → tools)
    if ('IntersectionObserver' in window) {
      const lazy = [
        ['#home-research', () => { if (!_loaded.research) loadResearch('all'); }],
        ['#home-learn',    () => { if (!_loaded.deepdives) loadDeepdives(); }],
      ];
      lazy.forEach(([sel, fn]) => {
        const elx = $(sel); if (!elx) return;
        const io = new IntersectionObserver(entries => {
          entries.forEach(en => { if (en.isIntersecting) { io.disconnect(); fn(); } });
        }, { rootMargin: '400px 0px' });
        io.observe(elx);
      });
      // fallback warms (also keeps search results complete)
      setTimeout(() => { if (!_loaded.research) loadResearch('all'); }, 6000);
      setTimeout(() => { if (!_loaded.deepdives) loadDeepdives(); }, 8000);
    } else {
      setTimeout(() => { if (!_loaded.research) loadResearch('all'); }, 1200);
      setTimeout(() => { if (!_loaded.deepdives) loadDeepdives(); }, 2200);
    }
  }
  if (document.readyState === 'loading') document.addEventListener('DOMContentLoaded', boot); else boot();
})();
