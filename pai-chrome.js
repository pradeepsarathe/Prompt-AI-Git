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
  function applyTheme(t) {
    const eff = (!t || t === 'auto') ? (systemDark() ? 'dark' : 'default') : t;
    if (eff === 'default') document.documentElement.removeAttribute('data-theme');
    else document.documentElement.setAttribute('data-theme', eff);
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
  window.toggleSubscribe = function (e) {
    e.stopPropagation();
    const m = $('#sub-menu'); m.classList.toggle('open'); $('#theme-menu').classList.remove('open'); $('#lang-menu').classList.remove('open');
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
    const freq = fr ? fr.value : 'weekly';
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
    const freq = rf ? rf.value : 'weekly';
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

  // ── BOOT ───────────────────────────────────────────────
  function boot() {
    let saved = 'auto'; try { saved = localStorage.getItem('pai_theme') || 'auto'; } catch (e) {}
    ensureThemeOptions(); applyTheme(saved); markActiveLang();
  }
  if (document.readyState === 'loading') document.addEventListener('DOMContentLoaded', boot); else boot();
})();
