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
  }
  if (document.readyState === 'loading') document.addEventListener('DOMContentLoaded', boot); else boot();
})();
