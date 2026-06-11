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
  window.setTheme = function (t) {
    if (t === 'default') document.documentElement.removeAttribute('data-theme');
    else document.documentElement.setAttribute('data-theme', t);
    try { localStorage.setItem('pai_theme', t); } catch (e) {}
    document.querySelectorAll('.theme-opt').forEach(o => o.classList.toggle('active', o.dataset.theme === t));
  };
  window.toggleThemeMenu = function (e) { e.stopPropagation(); $('#theme-menu').classList.toggle('open'); $('#sub-menu') && $('#sub-menu').classList.remove('open'); $('#lang-menu') && $('#lang-menu').classList.remove('open'); };

  // ── SUBSCRIBE ──────────────────────────────────────────
  window.toggleSubscribe = function (e) {
    e.stopPropagation();
    const m = $('#sub-menu'); m.classList.toggle('open'); $('#theme-menu').classList.remove('open'); $('#lang-menu').classList.remove('open');
    if (m.classList.contains('open')) { const i = $('#top-email'); if (i) setTimeout(() => i.focus(), 30); }
  };
  function subscribe(email) {
    // Same endpoint the briefing/home use; fall back gracefully in preview.
    return fetch('/subscribe', { method: 'POST', headers: { 'Content-Type': 'application/json' }, body: JSON.stringify({ email }) })
      .then(r => r.json()).catch(() => null);
  }
  window.doTopSubscribe = function (e) {
    e.preventDefault();
    const input = $('#top-email'), email = (input && input.value || '').trim();
    if (!email) return false;
    subscribe(email).then(r => {
      if (r && (r.ok || r.success || r.status === 'ok' || r.subscribed)) toast('✓ Subscribed! Check your inbox.');
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
    subscribe(email).then(r => {
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
    let saved = 'default'; try { saved = localStorage.getItem('pai_theme') || 'default'; } catch (e) {}
    setTheme(saved); markActiveLang();
  }
  if (document.readyState === 'loading') document.addEventListener('DOMContentLoaded', boot); else boot();
})();
