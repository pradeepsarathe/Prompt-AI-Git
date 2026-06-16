/* ════════════════════════════════════════════════════════════════════
   PromptAI — shared chrome behaviour (top bar + menus + toast)
   Loaded on education.html and archive.html. Mirrors the briefing's
   header so theme, language and subscribe behave identically.
   Sign-in / account sheet lives in pai-account.js (load it after this).
   ════════════════════════════════════════════════════════════════════ */
(function () {
  'use strict';
  const $ = s => document.querySelector(s);

  // ── TOAST ──────────────────────────────────────────────
  let _toastT;
  function toast(msg) { const t = $('#toast'); if (!t) return; t.textContent = msg; t.classList.add('show'); clearTimeout(_toastT); _toastT = setTimeout(() => t.classList.remove('show'), 2600); }
  window.toast = toast;

  // ── THEME ──────────────────────────────────────────────
  // R29: light themes + dark + follow-system (default = follow system)
  function systemDark() { try { return matchMedia('(prefers-color-scheme: dark)').matches; } catch (e) { return false; } }
  // Map each theme to the canvas colour used for the mobile browser chrome bar.
  const THEME_BG = { 'default':'#ffffff', 'promptai':'#f3f6fc', 'slate':'#f7f5f1', 'dark':'#17181c' };
  function setMetaThemeColor(eff) {
    let m = document.querySelector('meta[name="theme-color"]');
    if (!m) { m = document.createElement('meta'); m.setAttribute('name', 'theme-color'); document.head.appendChild(m); }
    m.setAttribute('content', THEME_BG[eff] || '#ffffff');
  }
  function applyTheme(t) {
    const eff = (!t || t === 'auto') ? (systemDark() ? 'dark' : 'default') : t;
    if (eff === 'default') document.documentElement.removeAttribute('data-theme');
    else document.documentElement.setAttribute('data-theme', eff);
    setMetaThemeColor(eff);
    document.querySelectorAll('.theme-opt').forEach(o => o.classList.toggle('active', (o.dataset.theme || '') === t));
  }
  window.setTheme = function (t) {
    try { localStorage.setItem('pai_theme', t); } catch (e) {}
    applyTheme(t);
  };
  // keep following the OS while in auto mode
  try {
    matchMedia('(prefers-color-scheme: dark)').addEventListener('change', () => {
      let s = 'auto'; try { s = localStorage.getItem('pai_theme') || 'auto'; } catch (e) {}
      if (s === 'auto') applyTheme('auto');
    });
  } catch (e) {}
  // add Dark + Follow-system options to any page's theme menu (no per-page edits)
  function ensureThemeOptions() {
    const menu = document.getElementById('theme-menu');
    if (!menu || menu.querySelector('[data-theme="dark"]')) return;
    menu.insertAdjacentHTML('beforeend',
      '<button class="theme-opt" data-theme="dark" onclick="setTheme(\'dark\')">' +
        '<span class="sw"><i style="background:#8ab4f8"></i><i style="background:#17181c"></i><i style="background:#2d2f33"></i></span>' +
        'Dark<span class="chk">\u2713</span></button>' +
      '<button class="theme-opt" data-theme="auto" onclick="setTheme(\'auto\')">' +
        '<span class="sw"><i style="background:#ffffff"></i><i style="background:#9aa0a6"></i><i style="background:#17181c"></i></span>' +
        'Follow system<span class="chk">\u2713</span></button>');
  }
  window.toggleThemeMenu = function (e) { e.stopPropagation(); ensureThemeOptions(); $('#theme-menu').classList.toggle('open'); $('#sub-menu') && $('#sub-menu').classList.remove('open'); $('#lang-menu') && $('#lang-menu').classList.remove('open'); };

  // ── SUBSCRIBE ──────────────────────────────────────────
  // Canonical popover markup — kept in ONE place so every page that loads the
  // chrome shows the identical "weekly / daily" briefing choice. Older pages
  // shipped a bare "Subscribe" popover (no frequency); we normalise them here
  // instead of editing dozens of HTML files. Only rebuilds when the frequency
  // control is missing, so up-to-date pages are left untouched.
  const SUB_MENU_HTML =
    '<h5>Get the briefing</h5>' +
    '<p class="sub-lead">The one story that matters, 5 headlines and the paper everyone\u2019s citing \u2014 daily or weekly, your call.</p>' +
    '<form onsubmit="return doTopSubscribe(event)">' +
      '<input id="top-email" type="email" placeholder="you@example.com" required aria-label="Email"/>' +
      '<div class="freq-row" role="radiogroup" aria-label="How often">' +
        '<label><input type="radio" name="sub-freq" value="daily" checked="checked"/> Daily</label>' +
        '<label><input type="radio" name="sub-freq" value="weekly"/> Weekly \u00b7 Tue</label>' +
      '</div>' +
      '<button type="submit">Subscribe free</button>' +
    '</form>' +
    '<p class="sub-note">No spam. Unsubscribe anytime. \u00b7 <a href="/issues">Read a sample briefing \u2192</a></p>';
  function ensureSubMenu() {
    const m = document.getElementById('sub-menu');
    if (!m) return;
    // Normalise legacy popovers to the canonical daily-first markup. Older pages
    // shipped weekly-first (or no frequency choice at all); rebuild unless THIS
    // page already has Daily as the checked default. Idempotent.
    const daily = m.querySelector('input[name="sub-freq"][value="daily"]');
    if (daily && daily.checked) return;
    m.innerHTML = SUB_MENU_HTML;
  }
  // Same idea for the right-rail promo (Learn AI / Archive). We only INJECT the
  // missing frequency control rather than rebuilding, since the rail markup is
  // page-specific.
  function ensureRailFreq() {
    const input = document.getElementById('rail-email'); if (!input) return;
    const form = input.closest('form'); if (!form) return;
    if (form.querySelector('input[name="rail-freq"]')) return;
    const row = document.createElement('div');
    row.className = 'freq-row'; row.setAttribute('role', 'radiogroup'); row.setAttribute('aria-label', 'How often');
    row.innerHTML = '<label><input type="radio" name="rail-freq" value="daily" checked="checked"/> Daily</label>' +
                    '<label><input type="radio" name="rail-freq" value="weekly"/> Weekly \u00b7 Tue</label>';
    const btn = form.querySelector('button[type="submit"]') || form.querySelector('button');
    if (btn) form.insertBefore(row, btn); else form.appendChild(row);
  }
  window.toggleSubscribe = function (e) {
    e.stopPropagation();
    ensureSubMenu();
    const m = $('#sub-menu'); m.classList.toggle('open'); $('#theme-menu') && $('#theme-menu').classList.remove('open'); $('#lang-menu') && $('#lang-menu').classList.remove('open');
    if (m.classList.contains('open')) { const i = $('#top-email'); if (i) setTimeout(() => i.focus(), 30); }
  };
  function subscribe(email, freq) {
    // Same endpoint the briefing/home use; fall back gracefully in preview.
    const frequency = freq === 'daily' ? 'daily' : 'weekly';
    return fetch('/subscribe', { method: 'POST', headers: { 'Content-Type': 'application/json' }, body: JSON.stringify({ email, frequency }) })
      .then(r => r.json()).catch(() => null);
  }
  window.doTopSubscribe = function (e) {
    e.preventDefault();
    const input = $('#top-email'), email = (input && input.value || '').trim();
    if (!email) return false;
    const fr = document.querySelector('input[name="sub-freq"]:checked');
    const freq = fr ? fr.value : 'daily';
    subscribe(email, freq).then(r => {
      if (r && (r.ok || r.success || r.status === 'ok' || r.subscribed)) toast(freq === 'daily' ? '✓ Subscribed — daily. Check your inbox.' : '✓ Subscribed — weekly. Check your inbox.');
      else toast('✓ Thanks — you’re on the list.');
      if (input) input.value = '';
    }).catch(() => toast('Saved — we’ll be in touch.'));
    $('#sub-menu').classList.remove('open');
    return false;
  };
  // right-rail promo (Learn AI / Archive carry one too)
  window.doRailSubscribe = function (e) {
    e.preventDefault();
    const input = $('#rail-email'), email = (input && input.value || '').trim();
    if (!email) return false;
    const rf = document.querySelector('input[name="rail-freq"]:checked');
    const freq = rf ? rf.value : 'daily';
    subscribe(email, freq).then(r => {
      if (r && (r.ok || r.success || r.status === 'ok' || r.subscribed)) toast('✓ Subscribed! Check your inbox.');
      else toast('✓ Thanks — you’re on the list.');
      if (input) input.value = '';
    }).catch(() => toast('Saved — we’ll be in touch.'));
    return false;
  };

  // ── LANGUAGE (Google Translate) ────────────────────────
  window.toggleLangMenu = function (e) {
    e.stopPropagation();
    const m = $('#lang-menu'); m.classList.toggle('open');
    $('#theme-menu').classList.remove('open'); $('#sub-menu').classList.remove('open');
  };
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

  // ── SEARCH (redirect into the briefing feed) ───────────
  window.onChromeSearch = function (e) {
    if (e.key !== 'Enter') return;
    const q = (e.target.value || '').trim();
    try { if (q) sessionStorage.setItem('pai_pending_search', q); } catch (err) {}
    location.href = 'index.html#news';
  };
  // mobile: magnifier button reveals the search bar under the top bar
  window.toggleMobileSearch = function (e) {
    if (e) e.stopPropagation();
    const tb = $('.topbar'); if (!tb) return;
    tb.classList.toggle('search-open');
    if (tb.classList.contains('search-open')) { const i = $('#pai-search'); if (i) setTimeout(() => i.focus(), 30); }
  };

  // ── global close handlers ──────────────────────────────
  document.addEventListener('click', e => {
    if (!e.target.closest('#theme-menu') && !e.target.closest('[onclick*="toggleThemeMenu"]')) $('#theme-menu') && $('#theme-menu').classList.remove('open');
    if (!e.target.closest('#sub-menu') && !e.target.closest('#subscribe-btn')) $('#sub-menu') && $('#sub-menu').classList.remove('open');
    if (!e.target.closest('#lang-menu') && !e.target.closest('#lang-btn')) $('#lang-menu') && $('#lang-menu').classList.remove('open');
  });
  document.addEventListener('keydown', e => { if (e.key === 'Escape') { window.closeSheet && window.closeSheet(); ['#theme-menu','#sub-menu','#lang-menu'].forEach(s => $(s) && $(s).classList.remove('open')); } });

  // ── A11Y + POWER-USER (parity with the home app) ───────
  // Inject a "Skip to content" link (targets the page's main region) so every
  // secondary page gets the same keyboard-first affordance index.html has.
  function ensureSkipLink() {
    if (document.querySelector('.skip-link')) return;
    let target = document.querySelector('main') || document.querySelector('h1');
    if (target && target.tagName !== 'MAIN') target = target.closest('section, .wrap, .canvas, main') || target;
    if (!target) return;
    if (!target.id) target.id = 'main';
    const a = document.createElement('a');
    a.className = 'skip-link'; a.href = '#' + target.id; a.textContent = 'Skip to content';
    document.body.insertBefore(a, document.body.firstChild);
  }
  // "/" focuses search from anywhere (ignored while typing in a field).
  document.addEventListener('keydown', e => {
    if (e.key !== '/' || e.metaKey || e.ctrlKey || e.altKey) return;
    const t = e.target, tag = t && t.tagName;
    if (tag === 'INPUT' || tag === 'TEXTAREA' || (t && t.isContentEditable)) return;
    const s = document.getElementById('pai-search');
    if (s) { e.preventDefault(); s.focus(); s.select && s.select(); }
  });

  // ── BACK TO TOP (universal floating button) ────────────
  function ensureBackToTop() {
    if (document.getElementById('to-top')) return;
    const b = document.createElement('button');
    b.id = 'to-top'; b.type = 'button';
    b.setAttribute('aria-label', 'Back to top'); b.title = 'Back to top';
    b.innerHTML = '<svg viewBox="0 0 24 24" aria-hidden="true"><path d="M12 8.3l-6 6 1.4 1.4 4.6-4.6 4.6 4.6 1.4-1.4z"/></svg>';
    b.addEventListener('click', () => {
      const rm = matchMedia('(prefers-reduced-motion: reduce)').matches;
      window.scrollTo({ top: 0, behavior: rm ? 'auto' : 'smooth' });
    });
    document.body.appendChild(b);
    const onScroll = () => b.classList.toggle('show', window.pageYOffset > 480);
    window.addEventListener('scroll', onScroll, { passive: true }); onScroll();
  }
  // ── KEYBOARD HELP (press ? for shortcuts) ─────────────
  function buildKbd() {
    var ex = document.getElementById('kbd-help'); if (ex) return ex;
    var o = document.createElement('div');
    o.id = 'kbd-help'; o.setAttribute('role', 'dialog'); o.setAttribute('aria-modal', 'true'); o.setAttribute('aria-label', 'Keyboard shortcuts');
    o.innerHTML = '<div class="kbd-card"><h3>Keyboard shortcuts</h3><dl>' +
      '<div><dt><kbd>/</kbd></dt><dd>Focus search</dd></div>' +
      '<div><dt><kbd>?</kbd></dt><dd>Show / hide this help</dd></div>' +
      '<div><dt><kbd>Esc</kbd></dt><dd>Close dialogs &amp; menus</dd></div>' +
      '</dl><button type="button" class="kbd-close">Got it</button></div>';
    o.addEventListener('click', function (e) { if (e.target === o || e.target.classList.contains('kbd-close')) o.classList.remove('open'); });
    document.body.appendChild(o); return o;
  }
  document.addEventListener('keydown', function (e) {
    if (e.key === '?' && !e.metaKey && !e.ctrlKey && !e.altKey) {
      var t = e.target, tag = t && t.tagName;
      if (tag === 'INPUT' || tag === 'TEXTAREA' || (t && t.isContentEditable)) return;
      e.preventDefault(); buildKbd().classList.toggle('open');
    } else if (e.key === 'Escape') { var k = document.getElementById('kbd-help'); if (k) k.classList.remove('open'); }
  });

  // ── OFFLINE BANNER (shows when the network drops) ─────
  function ensureOfflineBar() {
    var b = document.getElementById('offline-bar');
    if (!b) {
      b = document.createElement('div');
      b.id = 'offline-bar'; b.setAttribute('role', 'status'); b.setAttribute('aria-live', 'polite');
      b.textContent = 'You\u2019re offline — showing saved content';
      document.body.appendChild(b);
    }
    var sync = function () { b.classList.toggle('show', !navigator.onLine); };
    window.addEventListener('online', sync); window.addEventListener('offline', sync); sync();
  }

  // a11y: flag the current page's nav tab for assistive tech
  function markActiveTab() {
    document.querySelectorAll('.tab.active').forEach(el => el.setAttribute('aria-current', 'page'));
  }

  // ── BOOT ───────────────────────────────────────────────
  function boot() {
    let saved = 'auto'; try { saved = localStorage.getItem('pai_theme') || 'auto'; } catch (e) {}
    ensureThemeOptions(); ensureSubMenu(); ensureRailFreq(); ensureSkipLink(); ensureBackToTop(); ensureOfflineBar(); markActiveTab(); applyTheme(saved); markActiveLang();
    injectEnhStyles(); enhancePromptPage(); enhanceGlossaryPage();
  }
  // ── PROMPT + GLOSSARY DETAIL ENHANCEMENTS (R-next-3) ───
  // Run only on /prompt/<slug> and /glossary/<slug> pages, which all load this
  // shared chrome — so no per-page HTML edits (50 + 16 pages) are needed.
  function injectEnhStyles() {
    if (document.getElementById('pai-enh-styles')) return;
    var css =
      '.ph-var{color:var(--accent);background:var(--accent-subtle);border-radius:5px;padding:0 4px;font-weight:600;}' +
      ':root[data-theme="dark"] .ph-var{background:rgba(138,180,248,.18);}' +
      '.ph-count{display:inline-flex;align-items:center;font-size:0.74rem;font-weight:600;color:var(--accent);background:var(--accent-subtle);border-radius:12px;padding:3px 10px;white-space:nowrap;}' +
      '.listen-btn{display:inline-flex;align-items:center;gap:7px;padding:9px 16px;border-radius:18px;border:1px solid var(--border-soft);background:var(--card);color:var(--text-2);font-weight:600;font-size:0.84rem;font-family:inherit;cursor:pointer;margin-right:8px;}' +
      '.listen-btn:hover,.listen-btn.on{color:var(--accent);border-color:var(--accent);}' +
      '.g-share{display:flex;align-items:center;gap:8px;flex-wrap:wrap;margin:14px 0 0;}' +
      '.g-share-lbl{font-size:0.78rem;color:var(--text-3);font-weight:600;}' +
      '.g-share-ic{display:inline-flex;align-items:center;justify-content:center;width:36px;height:36px;border-radius:50%;border:1px solid var(--border-soft);background:var(--card);color:var(--text-2);cursor:pointer;transition:color .15s,border-color .15s;}' +
      '.g-share-ic:hover{color:var(--accent);border-color:var(--accent);}' +
      '.g-share-ic svg{width:17px;height:17px;fill:currentColor;}' +
      '.g-share-ic.ok{color:#188038;border-color:#188038;}';
    var s = document.createElement('style'); s.id = 'pai-enh-styles'; s.textContent = css; document.head.appendChild(s);
  }

  function enhancePromptPage() {
    var pre = document.getElementById('prompt-text');
    if (!pre || pre.dataset.enh) return;
    pre.dataset.enh = '1';
    // (1)+(2) highlight [bracketed] placeholders + count the unique ones
    try {
      var raw = pre.textContent;
      var esc = function (s) { return s.replace(/&/g, '&amp;').replace(/</g, '&lt;').replace(/>/g, '&gt;'); };
      var seen = {}, count = 0, html = '', last = 0, m;
      var re = /\[[^\]\n]+\]/g;
      while ((m = re.exec(raw))) {
        html += esc(raw.slice(last, m.index));
        html += '<span class="ph-var">' + esc(m[0]) + '</span>';
        var k = m[0].toLowerCase(); if (!seen[k]) { seen[k] = 1; count++; }
        last = m.index + m[0].length;
      }
      html += esc(raw.slice(last));
      if (count) pre.innerHTML = html;
      var actions = document.querySelector('.p-actions');
      if (count && actions && !actions.querySelector('.ph-count')) {
        var badge = document.createElement('span');
        badge.className = 'ph-count';
        badge.textContent = count + (count === 1 ? ' blank to fill' : ' blanks to fill');
        var copyBtn = actions.querySelector('#copy-btn');
        if (copyBtn && copyBtn.nextSibling) actions.insertBefore(badge, copyBtn.nextSibling);
        else actions.appendChild(badge);
      }
    } catch (e) {}
    // (3) press "c" to copy the prompt
    document.addEventListener('keydown', function (e) {
      if (e.key !== 'c' || e.metaKey || e.ctrlKey || e.altKey) return;
      var t = e.target, tag = t && t.tagName;
      if (tag === 'INPUT' || tag === 'TEXTAREA' || (t && t.isContentEditable)) return;
      var b = document.getElementById('copy-btn'); if (b) { e.preventDefault(); b.click(); }
    });
    // (4) make the category breadcrumb a link to the filtered library
    try {
      var crumbCur = document.querySelector('.crumbs span[aria-current="page"]');
      if (crumbCur) {
        var cat = crumbCur.textContent.trim();
        var a = document.createElement('a');
        a.href = '../prompts.html?cat=' + encodeURIComponent(cat);
        a.textContent = cat;
        crumbCur.parentNode.replaceChild(a, crumbCur);
      }
    } catch (e) {}
  }

  function enhanceGlossaryPage() {
    if (!/\/glossary\//.test(location.pathname)) return;
    var main = document.querySelector('main'); if (!main) return;
    var def = document.querySelector('.g-def');
    // (6) "Listen" — read the definition aloud via Web Speech
    try {
      if (def && 'speechSynthesis' in window) {
        var row = document.querySelector('.ask-row');
        if (row && !row.querySelector('.listen-btn')) {
          var speakText = [].slice.call(main.querySelectorAll('.g-def, .g-p'))
            .map(function (n) { return n.textContent.trim(); }).join('. ');
          var btn = document.createElement('button');
          btn.type = 'button'; btn.className = 'listen-btn';
          btn.innerHTML = '\uD83D\uDD0A Listen';
          var speaking = false;
          var stop = function () { speaking = false; btn.classList.remove('on'); btn.innerHTML = '\uD83D\uDD0A Listen'; try { speechSynthesis.cancel(); } catch (e) {} };
          btn.addEventListener('click', function () {
            if (speaking) { stop(); return; }
            try {
              speechSynthesis.cancel();
              var u = new SpeechSynthesisUtterance(speakText);
              u.rate = 1; u.onend = stop; u.onerror = stop;
              speechSynthesis.speak(u);
              speaking = true; btn.classList.add('on'); btn.innerHTML = '\u23F9 Stop';
            } catch (e) { stop(); }
          });
          window.addEventListener('beforeunload', stop);
          row.insertBefore(btn, row.firstChild);
        }
      }
    } catch (e) {}
    // (5) compact share row — X / LinkedIn / WhatsApp / copy link (parity with prompt pages)
    try { addGlossaryShare(main); } catch (e) {}
  }

  function addGlossaryShare(main) {
    var row = document.querySelector('.ask-row');
    if (!row || document.querySelector('.g-share')) return;
    var canon = document.querySelector('link[rel="canonical"]');
    var url = (canon && canon.getAttribute('href')) || location.href;
    var h1 = document.querySelector('h1');
    var title = (h1 ? h1.textContent.trim() : document.title) + ' \u2014 PromptAI glossary';
    var u = encodeURIComponent(url), tt = encodeURIComponent(title);
    var X = '<svg viewBox="0 0 24 24" aria-hidden="true"><path d="M18.244 2.25h3.308l-7.227 8.26 8.502 11.24h-6.657l-5.214-6.817L4.99 21.75H1.68l7.73-8.835L1.254 2.25H8.08l4.713 6.231 5.451-6.231z"/></svg>';
    var LI = '<svg viewBox="0 0 24 24" aria-hidden="true"><path d="M20.45 20.45h-3.55v-5.57c0-1.33-.03-3.04-1.85-3.04-1.86 0-2.14 1.45-2.14 2.94v5.67H9.36V9h3.41v1.56h.05c.47-.9 1.63-1.85 3.36-1.85 3.6 0 4.27 2.37 4.27 5.46v6.28zM5.34 7.43a2.06 2.06 0 1 1 0-4.12 2.06 2.06 0 0 1 0 4.12zM7.12 20.45H3.55V9h3.57v11.45z"/></svg>';
    var WA = '<svg viewBox="0 0 24 24" aria-hidden="true"><path d="M17.47 14.38c-.3-.15-1.76-.87-2.03-.97-.27-.1-.47-.15-.67.15-.2.3-.77.97-.94 1.17-.17.2-.35.22-.65.07-.3-.15-1.25-.46-2.39-1.47-.88-.79-1.48-1.76-1.65-2.06-.17-.3-.02-.46.13-.61.13-.13.3-.35.45-.52.15-.17.2-.3.3-.5.1-.2.05-.37-.02-.52-.07-.15-.67-1.62-.92-2.22-.24-.58-.49-.5-.67-.51l-.57-.01c-.2 0-.52.07-.8.37-.27.3-1.04 1.02-1.04 2.5 0 1.47 1.07 2.89 1.22 3.09.15.2 2.11 3.22 5.1 4.51.71.31 1.27.49 1.7.63.72.23 1.37.2 1.88.12.57-.09 1.76-.72 2.01-1.41.25-.7.25-1.29.17-1.41-.07-.12-.27-.2-.57-.35m-5.42 7.4h-.01a9.87 9.87 0 0 1-5.03-1.38l-.36-.21-3.74.98 1-3.65-.24-.37a9.86 9.86 0 0 1-1.51-5.26c0-5.45 4.44-9.88 9.9-9.88a9.83 9.83 0 0 1 7 2.9 9.83 9.83 0 0 1 2.89 7c0 5.45-4.44 9.88-9.9 9.88m8.42-18.3A11.82 11.82 0 0 0 12.05 0C5.5 0 .16 5.34.16 11.89c0 2.1.55 4.14 1.59 5.94L.06 24l6.33-1.66a11.88 11.88 0 0 0 5.66 1.44h.01c6.55 0 11.89-5.34 11.89-11.89 0-3.18-1.24-6.16-3.48-8.41z"/></svg>';
    var LN = '<svg viewBox="0 0 24 24" aria-hidden="true"><path d="M9 15l6-6M10.5 6.5l1-1a4 4 0 0 1 5.66 5.66l-1 1M13.5 17.5l-1 1a4 4 0 0 1-5.66-5.66l1-1" fill="none" stroke="currentColor" stroke-width="2" stroke-linecap="round"/></svg>';
    var box = document.createElement('div'); box.className = 'g-share';
    box.innerHTML = '<span class="g-share-lbl">Share</span>' +
      '<a class="g-share-ic" target="_blank" rel="noopener" aria-label="Share on X" title="Share on X" href="https://twitter.com/intent/tweet?text=' + tt + '&url=' + u + '">' + X + '</a>' +
      '<a class="g-share-ic" target="_blank" rel="noopener" aria-label="Share on LinkedIn" title="Share on LinkedIn" href="https://www.linkedin.com/sharing/share-offsite/?url=' + u + '">' + LI + '</a>' +
      '<a class="g-share-ic" target="_blank" rel="noopener" aria-label="Share on WhatsApp" title="Share on WhatsApp" href="https://wa.me/?text=' + tt + '%20' + u + '">' + WA + '</a>' +
      '<button class="g-share-ic" type="button" id="g-copy-link" aria-label="Copy link" title="Copy link">' + LN + '</button>';
    row.parentNode.insertBefore(box, row.nextSibling);
    var cp = box.querySelector('#g-copy-link');
    if (cp) cp.addEventListener('click', function () {
      (navigator.clipboard && navigator.clipboard.writeText ? navigator.clipboard.writeText(url) : Promise.reject()).then(
        function () { if (window.toast) toast('Link copied \u2014 share it anywhere'); cp.classList.add('ok'); setTimeout(function () { cp.classList.remove('ok'); }, 1500); },
        function () { if (window.toast) toast('Copy failed \u2014 copy the address bar URL'); });
    });
  }

  if (document.readyState === 'loading') document.addEventListener('DOMContentLoaded', boot); else boot();
})();
