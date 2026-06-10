/* ════════════════════════════════════════════════════════════════════
   PromptAI — Google-style UI layer
   Renders the live feeds (window.PAI) into the briefing shell.
   ════════════════════════════════════════════════════════════════════ */
(function () {
  'use strict';
  const P = window.PAI;

  // ── STATE ─────────────────────────────────────────────
  let _news = [], _papers = [], _blogs = [], _popular = {};
  let _loaded = { news: false, research: false, learn: false };
  let _newsTopic = 'All', _researchCat = 'all', _toolCat = 'all';
  let _view = 'home', _query = '';
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
  function thumb(url) {
    if (!url) return '';
    return 'https://images.weserv.nl/?url=' + encodeURIComponent(url.replace(/^https?:\/\//, '')) + '&w=300&h=220&fit=cover&output=webp&q=80';
  }
  function esc(s) { const d = document.createElement('div'); d.textContent = s || ''; return d.innerHTML; }
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
           <h4>${esc(s.title)}</h4>
           ${goodExcerpt(s.desc, 34) ? `<p class="excerpt">${esc(goodExcerpt(s.desc, 34))}</p>` : ''}
           <div class="card-meta">${time ? `<span>${time}</span>` : ''}${s.score ? `<span>▲ ${s.score}</span>` : ''}</div>
         </div>
         ${img}
       </div>`;
    c.onclick = () => openModal(s);
    return c;
  }

  // ── LEAD CARD ─────────────────────────────────────────
  function leadCard(s) {
    const c = el('article', 'lead');
    const media = s.image
      ? `<img class="lead-img" src="${thumb(s.image).replace('w=300&h=220','w=760&h=360')}" alt="" onerror="this.outerHTML=GRAD()"/>`
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
    c.onclick = () => openModal(s);
    return c;
  }
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
         <h4>${esc(p.title)}</h4>
         ${goodExcerpt(p.desc, 38) ? `<p class="excerpt">${esc(goodExcerpt(p.desc, 38))}</p>` : ''}
         <div class="card-meta"><span>${esc((p.authors || 'arXiv').slice(0, 60))}</span>${p.date ? `<span>${esc(p.date)}</span>` : ''}</div>
       </div>`;
    c.onclick = () => openModal({ src:'arxiv', title:p.title, url:p.url, desc:p.desc, date:p.date, topic:p.cat });
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
       <h4>${esc(t.name)}</h4>
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
    if (items.length > lim) {
      const wrap = el('div', 'load-more-wrap');
      const btn = el('button', 'load-more');
      btn.innerHTML = 'Load more <svg viewBox="0 0 24 24"><path d="M7 10l5 5 5-5z"/></svg>';
      btn.onclick = () => { _limit[key] = lim + (PAGE[key] || 10); rerender(); };
      wrap.appendChild(btn); node.appendChild(wrap);
    }
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
    renderNews(); renderHome(); renderTrending();
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
    if (_query) list = list.filter(s => match(s.title + ' ' + (s.desc || '')));
    const leadBox = $('#news-lead'); leadBox.innerHTML = '';
    if (list.length && !_query) { leadBox.appendChild(leadCard(list[0])); fillPaged($('#news-list'), list.slice(1), s => storyCard(s), 'news', renderNews); }
    else { fillPaged($('#news-list'), list, s => storyCard(s), 'news', renderNews); }
  }

  // ── HOME ──────────────────────────────────────────────
  function renderHome() {
    if (_news.length) {
      const lb = $('#home-lead'); lb.innerHTML = ''; lb.appendChild(leadCard(_news[0]));
      fill($('#home-top'), _news.slice(1, 6), s => storyCard(s));
    }
    if (_papers.length) fill($('#home-research'), _papers.slice(0, 3), paperCard);
    if (_blogs.length) fill($('#home-learn'), _blogs.slice(0, 3), s => storyCard(s));
  }

  // ── RESEARCH ──────────────────────────────────────────
  async function loadResearch(cat) {
    _researchCat = cat || _researchCat;
    _limit.research = PAGE.research;
    renderResearchChips();
    skeleton($('#research-list'), 5);
    try { _papers = await P.fetchPapers(_researchCat); } catch (e) { _papers = []; }
    _loaded.research = true;
    renderResearch(); renderHome();
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
    let list = _papers.slice();
    if (_query) list = list.filter(p => match(p.title + ' ' + (p.desc || '')));
    fillPaged($('#research-list'), list, paperCard, 'research', renderResearch);
  }

  // ── LEARN ─────────────────────────────────────────────
  async function loadLearn() {
    skeleton($('#learn-list'), 5);
    try { _blogs = await P.fetchBlogs(); } catch (e) { _blogs = []; }
    _loaded.learn = true;
    renderLearn(); renderHome();
  }
  function renderLearn() {
    let list = _blogs.slice();
    if (_query) list = list.filter(s => match(s.title + ' ' + (s.desc || '')));
    fillPaged($('#learn-list'), list, s => storyCard(s), 'learn', renderLearn);
  }

  // ── TOOLS ─────────────────────────────────────────────
  function renderTools() {
    const grid = $('#tools-grid'); grid.innerHTML = '';
    let list = TOOLS.filter(t => _toolCat === 'all' || t.cat === _toolCat);
    if (_query) list = list.filter(t => match(t.name + ' ' + t.desc + ' ' + t.tag));
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
      d.onclick = () => openModal(s);
      box.appendChild(d);
    });
  }

  // ── SEARCH ────────────────────────────────────────────
  function match(text) { return (text || '').toLowerCase().includes(_query); }
  window.onSearch = function (q) {
    _query = (q || '').trim().toLowerCase();
    _limit.news = PAGE.news; _limit.research = PAGE.research; _limit.learn = PAGE.learn; _limit.tools = PAGE.tools;
    // searching jumps Home → News so results are visible
    if (_query && _view === 'home') { go('news'); }
    if (_view === 'news' || _view === 'home') renderNews();
    else if (_view === 'research') renderResearch();
    else if (_view === 'learn') renderLearn();
    else if (_view === 'tools') renderTools();
  };

  // ── NAV ───────────────────────────────────────────────
  window.go = function (view) {
    _view = view;
    document.querySelectorAll('.view').forEach(v => v.classList.remove('active'));
    $('#view-' + view).classList.add('active');
    document.querySelectorAll('.tab[data-nav]').forEach(r => r.classList.toggle('active', r.dataset.nav === view));
    if (view === 'research' && !_loaded.research) loadResearch('all');
    if (view === 'learn' && !_loaded.learn) loadLearn();
    if (view === 'tools') renderTools();
    // keep the active tab scrolled into view on narrow screens
    const at = document.querySelector('.tab.active[data-nav]');
    if (at && at.scrollIntoView) { try { at.scrollIntoView({ inline:'nearest', block:'nearest' }); } catch (e) {} }
    window.scrollTo({ top: 0, behavior: 'auto' });
  };
  window.toggleRail = function () {};

  // ── MODAL ─────────────────────────────────────────────
  let _modalUrl = '';
  window.openModal = function (s) {
    _modalUrl = s.url;
    P.bumpReadCount(s.url);
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
  };
  window.closeModal = function () { $('#modal').classList.remove('open'); document.body.style.overflow = ''; };
  window.copyLink = function () {
    navigator.clipboard.writeText(_modalUrl).then(() => { $('#m-copy').textContent = '✓ Copied'; setTimeout(() => $('#m-copy').textContent = '🔗 Copy', 1800); }).catch(() => toast('Copy failed'));
  };
  document.addEventListener('keydown', e => { if (e.key === 'Escape') { closeModal(); closeSheet(); $('#theme-menu').classList.remove('open'); $('#sub-menu').classList.remove('open'); $('#lang-menu').classList.remove('open'); } });

  // ── SIGN-IN SHEET ─────────────────────────────────────
  function userGet() { try { return JSON.parse(localStorage.getItem('pai_user') || 'null'); } catch (e) { return null; } }
  function userSet(u) { try { localStorage.setItem('pai_user', JSON.stringify(u)); } catch (e) {} renderUser(); }
  function renderUser() {
    const u = userGet();
    if (u) {
      $('#signin-btn').style.display = 'none';
      const av = $('#avatar-btn'); av.style.display = 'flex'; av.textContent = (u.name || u.email || '?').trim().charAt(0).toUpperCase();
    } else { $('#signin-btn').style.display = 'flex'; $('#avatar-btn').style.display = 'none'; }
  }
  window.openSheet = function () {
    const u = userGet(), body = $('#sheet-body');
    if (u) {
      $('#sheet-title').textContent = 'Your account';
      body.innerHTML =
        `<div class="signed-card">
           <div class="big-av">${(u.name || u.email).charAt(0).toUpperCase()}</div>
           <div style="font-weight:500;font-size:1.05rem">${esc(u.name || 'Reader')}</div>
           <div style="color:var(--text-2);font-size:0.86rem">${esc(u.email)}</div>
         </div>
         <p class="lead-copy">You're signed in on this device. Your reading preferences are saved locally.</p>
         <button class="sheet-btn" style="background:var(--bg-subtle);color:var(--text)" onclick="signOut()">Sign out</button>`;
    } else {
      $('#sheet-title').textContent = 'Sign in to PromptAI';
      body.innerHTML =
        `<p class="lead-copy">Sign in to personalise your feed and save articles. We only store this on your device.</p>
         <form onsubmit="return doSignIn(event)">
           <div class="field"><label>Name</label><input id="si-name" type="text" placeholder="Your name" autocomplete="name"/></div>
           <div class="field"><label>Email</label><input id="si-email" type="email" placeholder="you@example.com" required autocomplete="email"/></div>
           <button class="sheet-btn" type="submit">Continue</button>
         </form>`;
    }
    $('#sheet').classList.add('open'); $('#sheet-overlay').classList.add('open');
  };
  window.closeSheet = function () { $('#sheet').classList.remove('open'); $('#sheet-overlay').classList.remove('open'); };
  window.doSignIn = function (e) {
    e.preventDefault();
    const name = $('#si-name').value.trim(), email = $('#si-email').value.trim();
    if (!email) return false;
    userSet({ name, email }); closeSheet(); toast('Signed in — welcome' + (name ? ', ' + name : '') + '!');
    return false;
  };
  window.signOut = function () { localStorage.removeItem('pai_user'); renderUser(); closeSheet(); toast('Signed out'); };

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

  // ── THEME ─────────────────────────────────────────────
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
    renderBrandMark(t);
  };
  function renderBrandMark() {
    // Canonical PromptAI mark = accent dot + serif wordmark (matches emails & main site).
    // The dot uses var(--accent), so it follows the active theme automatically.
    const d = $('#brand-dot'); if (d) d.style.background = 'var(--accent)';
  }

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
    renderUser();
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
    // warm research + learn in background so Home previews fill in
    setTimeout(() => { if (!_loaded.research) loadResearch('all'); }, 1200);
    setTimeout(() => { if (!_loaded.learn) loadLearn(); }, 2200);
  }
  if (document.readyState === 'loading') document.addEventListener('DOMContentLoaded', boot); else boot();
})();
