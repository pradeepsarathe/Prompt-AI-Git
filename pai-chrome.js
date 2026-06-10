/* ════════════════════════════════════════════════════════════════════
   PromptAI — shared chrome behaviour (top bar + menus + sheet + toast)
   Loaded on education.html and archive.html. Mirrors the briefing's
   header so theme, language, subscribe and sign-in behave identically.
   ════════════════════════════════════════════════════════════════════ */
(function () {
  'use strict';
  const $ = s => document.querySelector(s);
  const esc = s => { const d = document.createElement('div'); d.textContent = s || ''; return d.innerHTML; };

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

  // ── SIGN-IN SHEET ──────────────────────────────────────
  function userGet() { try { return JSON.parse(localStorage.getItem('pai_user') || 'null'); } catch (e) { return null; } }
  function userSet(u) { try { localStorage.setItem('pai_user', JSON.stringify(u)); } catch (e) {} renderUser(); }
  function renderUser() {
    const u = userGet(), s = $('#signin-btn'), av = $('#avatar-btn');
    if (!s || !av) return;
    if (u) { s.style.display = 'none'; av.style.display = 'flex'; av.textContent = (u.name || u.email || '?').trim().charAt(0).toUpperCase(); }
    else { s.style.display = 'flex'; av.style.display = 'none'; }
  }
  window.openSheet = function () {
    const u = userGet(), body = $('#sheet-body');
    if (u) {
      $('#sheet-title').textContent = 'Your account';
      body.innerHTML =
        '<div class="signed-card"><div class="big-av">' + esc((u.name || u.email).charAt(0).toUpperCase()) + '</div>' +
        '<div style="font-weight:500;font-size:1.05rem">' + esc(u.name || 'Reader') + '</div>' +
        '<div style="color:var(--text-2);font-size:0.86rem">' + esc(u.email) + '</div></div>' +
        '<p class="lead-copy">You\u2019re signed in on this device. Your reading preferences are saved locally.</p>' +
        '<button class="sheet-btn" style="background:var(--bg-subtle);color:var(--text)" onclick="signOut()">Sign out</button>';
    } else {
      $('#sheet-title').textContent = 'Sign in to PromptAI';
      body.innerHTML =
        '<p class="lead-copy">Sign in to personalise your feed and save articles. We only store this on your device.</p>' +
        '<form onsubmit="return doSignIn(event)">' +
        '<div class="field"><label>Name</label><input id="si-name" type="text" placeholder="Your name" autocomplete="name"/></div>' +
        '<div class="field"><label>Email</label><input id="si-email" type="email" placeholder="you@example.com" required autocomplete="email"/></div>' +
        '<button class="sheet-btn" type="submit">Continue</button></form>';
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
  window.signOut = function () { try { localStorage.removeItem('pai_user'); } catch (e) {} renderUser(); closeSheet(); toast('Signed out'); };

  // ── SEARCH (redirect into the briefing feed) ───────────
  window.onChromeSearch = function (e) {
    if (e.key !== 'Enter') return;
    const q = (e.target.value || '').trim();
    try { if (q) sessionStorage.setItem('pai_pending_search', q); } catch (err) {}
    location.href = 'index.html#news';
  };

  // ── global close handlers ──────────────────────────────
  document.addEventListener('click', e => {
    if (!e.target.closest('#theme-menu') && !e.target.closest('[onclick*="toggleThemeMenu"]')) $('#theme-menu') && $('#theme-menu').classList.remove('open');
    if (!e.target.closest('#sub-menu') && !e.target.closest('#subscribe-btn')) $('#sub-menu') && $('#sub-menu').classList.remove('open');
    if (!e.target.closest('#lang-menu') && !e.target.closest('#lang-btn')) $('#lang-menu') && $('#lang-menu').classList.remove('open');
  });
  document.addEventListener('keydown', e => { if (e.key === 'Escape') { closeSheet(); ['#theme-menu','#sub-menu','#lang-menu'].forEach(s => $(s) && $(s).classList.remove('open')); } });

  // ── BOOT ───────────────────────────────────────────────
  function boot() {
    let saved = 'default'; try { saved = localStorage.getItem('pai_theme') || 'default'; } catch (e) {}
    setTheme(saved); markActiveLang(); renderUser();
  }
  if (document.readyState === 'loading') document.addEventListener('DOMContentLoaded', boot); else boot();
})();
