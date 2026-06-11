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
  let _loaded = { news: false, research: false, learn: false };
  let _newsTopic = 'All', _researchCat = 'all', _toolCat = 'all';
  let _view = 'home', _query = '', _prevView = 'home';
  const PAGE = { news:8, research:8, learn:8, tools:6 };
  let _limit = { news:PAGE.news, research:PAGE.research, learn:PAGE.learn, tools:PAGE.tools };

  // ── TOOLS DATA (carried over; clearer access labels) ──
  const TOOLS = [
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

  // ── STORY CARD (Google-news list row) ─────────────────
  function storyCard(s, opts) {
    opts = opts || {};
    const c = el('article', 'card');
    const img = (s.image && !opts.noThumb)
      ? `<img class="card-thumb" src="${thumb(s.image)}" alt="" loading="lazy" onerror="this.remove()"/>` : '';
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
    a.href = t.url; a.target = '_blank'; a.rel = 'noopener'; a.dataset.cat = t.cat;
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
    renderNews(); renderHome(); renderTrending();
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
  function renderHome() {
    if (_news.length) {
      const li = pickLead(_news);
      const lb = $('#home-lead'); lb.innerHTML = ''; lb.appendChild(leadCard(_news[li]));
      fill($('#home-top'), _news.filter((_, i) => i !== li).slice(0, 5), s => storyCard(s));
    }
    if (_papers.length) fill($('#home-research'), _papers.slice(0, 3), paperCard);
    if (_blogs.length) fill($('#home-learn'), _blogs.slice(0, 3), s => storyCard(s));
    const ht = $('#home-tools');
    if (ht && !ht.children.length) fill(ht, TOOLS.slice(0, 4), toolCard);
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

  // ── LEARN / BLOGS (stories with images promoted, image-on-top) ──
  async function loadLearn() {
    skeleton($('#learn-list'), 5);
    try { _blogs = await P.fetchBlogs(); } catch (e) { _blogs = []; }
    _loaded.learn = true;
    archiveStories(_blogs, 'blog');
    renderLearn(); renderHome();
    if (_query) renderSearch();
  }
  function renderLearn() {
    const box = $('#learn-list'); box.innerHTML = '';
    const list = _blogs.slice();
    if (!list.length) { box.innerHTML = '<div class="empty">Nothing here yet — live feeds are catching up. Refresh in a moment.</div>'; return; }
    // promote stories that ship an image; they get the visual treatment
    const ordered = [...list.filter(s => s.image), ...list.filter(s => !s.image)];
    const lim = _limit.learn;
    const show = ordered.slice(0, lim);
    const grid = el('div', 'vis-grid');
    show.filter(s => s.image).forEach(s => grid.appendChild(visCard(s)));
    if (grid.children.length) box.appendChild(grid);
    show.filter(s => !s.image).forEach(s => box.appendChild(storyCard(s, { noThumb: true })));
    appendLoadMore(box, ordered.length > lim, 'learn', renderLearn);
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

  // ── SEARCH (dedicated results view across everything) ─
  function match(text) { return (text || '').toLowerCase().includes(_query); }
  window.onSearch = function (q) {
    _query = (q || '').trim().toLowerCase();
    if (_query) {
      if (_view !== 'search') _prevView = _view;
      showView('search');
      // make sure every dataset is loaded so results are complete
      if (!_loaded.research) loadResearch(_researchCat);
      if (!_loaded.learn) loadLearn();
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
    total += searchGroup('News', _news.filter(s => match(s.title + ' ' + (s.desc || ''))), s => storyCard(s), frag);
    total += searchGroup('Research papers', _papers.filter(p => match(p.title + ' ' + (p.desc || ''))), paperCard, frag);
    total += searchGroup('Deep dives & explainers', _blogs.filter(s => match(s.title + ' ' + (s.desc || ''))), s => storyCard(s, { noThumb: true }), frag);
    const toolHits = TOOLS.filter(t => match(t.name + ' ' + t.desc + ' ' + t.tag));
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
    const loading = !_loaded.news || !_loaded.research || !_loaded.learn;
    if (!total) {
      box.innerHTML = loading
        ? '<div class="empty">Searching the live feeds…</div>'
        : '<div class="empty">No matches for “' + esc(_query) + '”. Try a shorter keyword — search covers news, papers, blogs and tools currently in the feed.</div>';
    }
  }
  window.clearSearch = function () {
    const si = $('#pai-search'); if (si) si.value = '';
    onSearch('');
  };

  // ── NAV ───────────────────────────────────────────────
  const VIEWS = ['home', 'news', 'research', 'learn', 'tools'];
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
    if (view === 'learn' && !_loaded.learn) loadLearn();
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
    const h = (location.hash || '').replace('#', '');
    const v = VIEWS.includes(h) ? h : 'home';
    if (v !== _view) { _navFromUrl = true; go(v); _navFromUrl = false; }
  }
  window.addEventListener('popstate', applyLocation);
  window.addEventListener('hashchange', applyLocation);
  window.toggleRail = function () {};

  // ── MODAL ─────────────────────────────────────────────
  let _modalUrl = '';
  let _modalOpener = null; // focus returns here on close (a11y)
  window.openModal = function (s) {
    _modalOpener = document.activeElement;
    _modalUrl = s.url;
    P.bumpReadCount(s.url);
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
    $('#modal').classList.add('open'); document.body.style.overflow = 'hidden';
    const x = document.querySelector('#modal .modal-x'); if (x) x.focus();
  };
  window.closeModal = function () {
    $('#modal').classList.remove('open'); document.body.style.overflow = '';
    if (_modalOpener && _modalOpener.focus) { try { _modalOpener.focus(); } catch (e) {} }
    _modalOpener = null;
  };
  window.copyLink = function () {
    navigator.clipboard.writeText(_modalUrl).then(() => { $('#m-copy').textContent = '✓ Copied'; setTimeout(() => $('#m-copy').textContent = '🔗 Copy', 1800); }).catch(() => toast('Copy failed'));
  };
  document.addEventListener('keydown', e => { if (e.key === 'Escape') { closeModal(); window.closeSheet && window.closeSheet(); $('#theme-menu').classList.remove('open'); $('#sub-menu').classList.remove('open'); $('#lang-menu').classList.remove('open'); } });

  // ── NEWSLETTER ────────────────────────────────────────
  window.doSubscribe = function (e) {
    e.preventDefault();
    const email = $('#promo-email').value.trim();
    if (!email) return false;
    toast('Subscribing…');
    P.subscribe(email).then(r => {
      if (r && (r.ok || r.success || r.status === 'ok' || r.subscribed)) toast('✓ Subscribed! Check your inbox.');
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
    P.subscribe(email).then(r => {
      if (r && (r.ok || r.success || r.status === 'ok' || r.subscribed)) toast('✓ Subscribed! Check your inbox.');
      else toast('✓ Thanks — you’re on the list.');
      if (input) input.value = '';
    }).catch(() => toast('Saved — we’ll be in touch.'));
    $('#sub-menu').classList.remove('open');
    return false;
  };
  window.setTheme = function (t) {
    if (t === 'default') document.documentElement.removeAttribute('data-theme');
    else document.documentElement.setAttribute('data-theme', t);
    try { localStorage.setItem('pai_theme', t); } catch (e) {}
    document.querySelectorAll('.theme-opt').forEach(o => o.classList.toggle('active', o.dataset.theme === t));
  };

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

  // ── COUNTERS ──────────────────────────────────────────
  function fmt(n) { return n >= 1e6 ? (n / 1e6).toFixed(1) + 'M' : n >= 1e3 ? (n / 1e3).toFixed(1) + 'k' : String(n); }
  async function loadStats() {
    const d = await P.syncStats();
    if (!d) return;
    if (d.totalVisitors != null) {
      const v = fmt(d.totalVisitors);
      const a = $('#stat-visitors'); if (a) a.textContent = v;
      const b = $('#rail-stat-visitors'); if (b) b.textContent = v;
    }
    if (d.articlesReadTotal != null) {
      const v = fmt(d.articlesReadTotal);
      const a = $('#stat-reads'); if (a) a.textContent = v;
      const b = $('#rail-stat-reads'); if (b) b.textContent = v;
    }
  }

  // ── RAIL SUBSCRIBE (mirrors the right-rail promo; always visible) ──
  window.doRailSubscribe = function (e) {
    e.preventDefault();
    const input = $('#rail-email');
    const email = (input && input.value || '').trim();
    if (!email) return false;
    P.subscribe(email).then(r => {
      if (r && (r.ok || r.success || r.status === 'ok' || r.subscribed)) toast('✓ Subscribed! Check your inbox.');
      else toast('✓ Thanks — you’re on the list.');
      if (input) input.value = '';
    }).catch(() => toast('Saved — we’ll be in touch.'));
    return false;
  };

  // ── BOOT ──────────────────────────────────────────────
  function boot() {
    let saved = 'default';
    try { saved = localStorage.getItem('pai_theme') || 'default'; } catch (e) {}
    setTheme(saved);
    markActiveLang();
    // rail sources
    const railSrc = $('#rail-sources');
    if (railSrc) [['tc','techcrunch.com'],['openai','openai.com'],['hf','huggingface.co'],['google','research.google'],['arxiv','arxiv.org'],['hn','ycombinator.com']]
      .forEach(([src, dom]) => {
        const d = el('div', 'rail-src');
        d.innerHTML = `<img src="${favicon(dom)}" alt="" onerror="this.style.visibility='hidden'"/> ${P.srcLabel(src)}`;
        railSrc.appendChild(d);
      });
    renderTools();
    // honor a #view hash (links from education.html / archive.html land on the right tab)
    const h = (location.hash || '').replace('#', '');
    if (['home','news','research','learn','tools'].includes(h)) go(h);
    // apply a search handed off from another page's top-bar search
    try {
      const pq = sessionStorage.getItem('pai_pending_search');
      if (pq) { sessionStorage.removeItem('pai_pending_search'); const si = $('#pai-search'); if (si) si.value = pq; onSearch(pq); }
    } catch (e) {}
    loadNews();
    loadStats();
    // home sections load as you scroll toward them (research → blogs → tools)
    if ('IntersectionObserver' in window) {
      const lazy = [
        ['#home-research', () => { if (!_loaded.research) loadResearch('all'); }],
        ['#home-learn',    () => { if (!_loaded.learn) loadLearn(); }],
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
      setTimeout(() => { if (!_loaded.learn) loadLearn(); }, 8000);
    } else {
      setTimeout(() => { if (!_loaded.research) loadResearch('all'); }, 1200);
      setTimeout(() => { if (!_loaded.learn) loadLearn(); }, 2200);
    }
  }
  if (document.readyState === 'loading') document.addEventListener('DOMContentLoaded', boot); else boot();
})();
