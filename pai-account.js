/* ════════════════════════════════════════════════════════════════════
   PromptAI — shared account layer (sign-in sheet + per-user saved data)
   Loaded on index.html, education.html and archive.html AFTER
   pai-google-ui.js / pai-chrome.js (it overrides their sheet handlers).

   Restores the old site's behaviour:
   • Real accounts via the /auth Pages Function (signup / login / session)
     — token in localStorage `pai_token`, session in `pai_session_db`.
   • Per-user saved data (learning + browsing history) in localStorage
     `pai_user_<hash>` and synced to KV via /auth getdata / setdata.
   • Graceful fallback to device-only mode when /auth is unreachable
     (preview, first deploy, offline) — mirrors the lightweight pai_user
     behaviour the new chrome shipped with.
   ════════════════════════════════════════════════════════════════════ */
(function () {
  'use strict';
  const $ = s => document.querySelector(s);
  const esc = s => { const d = document.createElement('div'); d.textContent = s || ''; return d.innerHTML; };
  const say = msg => { if (window.toast) window.toast(msg); };

  // ── session state ─────────────────────────────────────
  function getToken() { try { return localStorage.getItem('pai_token') || ''; } catch (e) { return ''; } }
  function getSession() {
    try {
      const s = JSON.parse(localStorage.getItem('pai_session_db') || 'null');
      if (s && s.email) return s;
    } catch (e) {}
    // legacy device-only sign-in from the first briefing release
    try {
      const u = JSON.parse(localStorage.getItem('pai_user') || 'null');
      if (u && u.email) return { email: u.email, name: u.name || '', local: true };
    } catch (e) {}
    return null;
  }
  function setSession(sess, token) {
    try {
      if (sess) localStorage.setItem('pai_session_db', JSON.stringify(sess));
      else localStorage.removeItem('pai_session_db');
      if (token) localStorage.setItem('pai_token', token);
      else if (token === '') localStorage.removeItem('pai_token');
      localStorage.removeItem('pai_user'); // retire the legacy key
    } catch (e) {}
    renderUser();
  }

  // ── per-user data (saved / liked / history / learning) ─
  function dataKey() {
    const s = getSession();
    let id = 'guest';
    if (s) { try { id = btoa(s.email).slice(0, 12); } catch (e) { id = s.email.slice(0, 12); } }
    return 'pai_user_' + id;
  }
  function blankData() { return { saved: [], liked: [], history: [], learning: [] }; }
  function getData() {
    try { return Object.assign(blankData(), JSON.parse(localStorage.getItem(dataKey()) || '{}')); }
    catch (e) { return blankData(); }
  }
  function putData(d) { try { localStorage.setItem(dataKey(), JSON.stringify(d)); } catch (e) {} }

  const CAPS = { saved: 500, liked: 500, history: 200, learning: 200 };

  // record(kind, {url,title,src}) — local first, then merge to backend.
  async function record(kind, item) {
    if (!item || !item.url || !CAPS[kind]) return;
    const stamp = kind === 'learning' ? 'learnedAt' : 'at';
    const d = getData();
    d[kind] = (d[kind] || []).filter(x => x.url !== item.url);
    d[kind].unshift(Object.assign({}, item, { [stamp]: Date.now() }));
    d[kind] = d[kind].slice(0, CAPS[kind]);
    putData(d);
    syncUp(kind, d);
  }

  // unrecord(kind, url) — remove from a list (un-save / un-like, R28).
  async function unrecord(kind, url) {
    if (!url || !CAPS[kind]) return;
    const d = getData();
    d[kind] = (d[kind] || []).filter(x => x.url !== url);
    putData(d);
    // push the removal to the server copy (overwrite that list)
    const token = getToken(); const sess = getSession();
    if (!token || !sess || sess.local) return;
    try {
      const g = await api({ action: 'getdata', token });
      if (!g || g.error) return;
      const server = Object.assign(blankData(), g.data || {});
      server[kind] = (server[kind] || []).filter(x => x.url !== url);
      await api({ action: 'setdata', token, data: server });
    } catch (e) { /* offline — local removal already done */ }
  }

  // merge one list into the server copy without clobbering other devices
  async function syncUp(kind, local) {
    const token = getToken();
    const sess = getSession();
    if (!token || !sess || sess.local) return;
    try {
      const g = await api({ action: 'getdata', token });
      if (!g || g.error) return;
      const server = Object.assign(blankData(), g.data || {});
      const stamp = kind === 'learning' ? 'learnedAt' : 'at';
      const byUrl = new Map((server[kind] || []).map(x => [x.url, x]));
      (local[kind] || []).forEach(x => {
        const p = byUrl.get(x.url);
        if (!p || (x[stamp] || 0) > (p[stamp] || 0)) byUrl.set(x.url, x);
      });
      server[kind] = [...byUrl.values()]
        .sort((a, b) => (b[stamp] || 0) - (a[stamp] || 0)).slice(0, CAPS[kind]);
      await api({ action: 'setdata', token, data: server });
      putData(server);
    } catch (e) { /* offline — local copy already saved */ }
  }

  async function pullData() {
    const token = getToken();
    const sess = getSession();
    if (!token || !sess || sess.local) return getData();
    try {
      const g = await api({ action: 'getdata', token });
      if (g && g.data) {
        const merged = Object.assign(blankData(), g.data);
        putData(merged);
        return merged;
      }
    } catch (e) {}
    return getData();
  }

  function api(body) {
    return fetch('/auth', {
      method: 'POST', headers: { 'Content-Type': 'application/json' },
      body: JSON.stringify(body),
    }).then(r => r.json());
  }

  // ── header button ─────────────────────────────────────
  function renderUser() {
    const u = getSession(), s = $('#signin-btn'), av = $('#avatar-btn');
    if (!s || !av) return;
    if (u) {
      s.style.display = 'none'; av.style.display = 'flex';
      av.textContent = (u.name || u.email || '?').trim().charAt(0).toUpperCase();
    } else { s.style.display = 'flex'; av.style.display = 'none'; }
  }

  // ── account sheet ─────────────────────────────────────
  function itemRows(list, stamp, empty) {
    if (!list || !list.length) return '<p class="acct-empty">' + empty + '</p>';
    return '<div class="acct-list">' + list.slice(0, 6).map(x =>
      '<a class="acct-item" href="' + esc(x.url) + '" target="_blank" rel="noopener">' +
        '<span class="t">' + esc(x.title || x.url) + '</span>' +
        '<span class="m">' + esc(x.src || '') + (x[stamp] ? ' · ' + timeAgo(x[stamp]) : '') + '</span>' +
      '</a>').join('') + '</div>';
  }
  function timeAgo(ms) {
    const s = Math.floor((Date.now() - ms) / 1000);
    if (s < 60) return 'just now';
    if (s < 3600) return Math.floor(s / 60) + 'm ago';
    if (s < 86400) return Math.floor(s / 3600) + 'h ago';
    const d = Math.floor(s / 86400);
    return d === 1 ? 'yesterday' : d + 'd ago';
  }

  window.openSheet = function () {
    const u = getSession(), body = $('#sheet-body');
    if (!body) return;
    if (u) {
      $('#sheet-title').textContent = 'Your account';
      const d = getData();
      body.innerHTML =
        '<div class="signed-card">' +
          '<div class="big-av">' + esc((u.name || u.email).charAt(0).toUpperCase()) + '</div>' +
          '<div style="font-weight:500;font-size:1.05rem">' + esc(u.name || 'Reader') + '</div>' +
          '<div style="color:var(--text-2);font-size:0.86rem">' + esc(u.email) + '</div>' +
          (u.local ? '<div class="acct-offline">Device-only — account backend unreachable</div>' : '') +
        '</div>' +
        '<h4 class="acct-h">🎓 Continue learning</h4>' +
        '<div id="acct-learning">' + itemRows(d.learning, 'learnedAt', 'Courses and guides you open on <a href="education.html" style="color:var(--accent)">Learn AI</a> appear here.') + '</div>' +
        '<h4 class="acct-h">🕐 Recently read</h4>' +
        '<div id="acct-history">' + itemRows(d.history, 'at', 'Stories you open are saved here so you can find them again.') + '</div>' +
        '<button class="sheet-btn" style="background:var(--bg-subtle);color:var(--text);margin-top:22px" onclick="signOut()">Sign out</button>';
      // refresh from the backend, then re-render the two lists in place
      pullData().then(fresh => {
        const l = $('#acct-learning'), h = $('#acct-history');
        if (l) l.innerHTML = itemRows(fresh.learning, 'learnedAt', 'Courses and guides you open on <a href="education.html" style="color:var(--accent)">Learn AI</a> appear here.');
        if (h) h.innerHTML = itemRows(fresh.history, 'at', 'Stories you open are saved here so you can find them again.');
      });
    } else {
      $('#sheet-title').textContent = 'Sign in to PromptAI';
      body.innerHTML =
        '<div class="acct-tabs">' +
          '<button class="acct-tab active" id="acct-tab-login" onclick="acctMode(\'login\')">Sign in</button>' +
          '<button class="acct-tab" id="acct-tab-signup" onclick="acctMode(\'signup\')">Create account</button>' +
        '</div>' +
        '<p class="lead-copy" id="acct-copy">Welcome back — your saved learning and reading history sync to every device.</p>' +
        '<form onsubmit="return doSignIn(event)">' +
          '<div class="field" id="f-name" style="display:none"><label>Name</label><input id="si-name" type="text" placeholder="Your name" autocomplete="name"/></div>' +
          '<div class="field"><label>Email</label><input id="si-email" type="email" placeholder="you@example.com" required autocomplete="email"/></div>' +
          '<div class="field"><label>Password</label><input id="si-pass" type="password" placeholder="At least 8 characters" required minlength="8" autocomplete="current-password"/></div>' +
          '<div class="acct-err" id="acct-err"></div>' +
          '<button class="sheet-btn" type="submit" id="si-submit">Sign in</button>' +
          '<p class="acct-forgot" id="acct-forgot" style="margin-top:12px;text-align:center;font-size:0.84rem"><a href="#" onclick="return acctForgot()" style="color:var(--accent)">Forgot password?</a></p>' +
        '</form>';
    }
    $('#sheet').classList.add('open'); $('#sheet-overlay').classList.add('open');
  };
  window.closeSheet = function () {
    const s = $('#sheet'), o = $('#sheet-overlay');
    if (s) s.classList.remove('open'); if (o) o.classList.remove('open');
  };

  let _mode = 'login';
  window.acctMode = function (m) {
    _mode = m;
    const login = m === 'login';
    $('#acct-tab-login').classList.toggle('active', login);
    $('#acct-tab-signup').classList.toggle('active', !login);
    $('#f-name').style.display = login ? 'none' : 'block';
    $('#si-name') && ($('#si-name').required = !login);
    $('#si-submit').textContent = login ? 'Sign in' : 'Create account';
    const fg = $('#acct-forgot'); if (fg) fg.style.display = login ? 'block' : 'none';
    $('#acct-copy').textContent = login
      ? 'Welcome back — your saved learning and reading history sync to every device.'
      : 'One account, every device — keep your learning progress and reading history wherever you sign in.';
    const err = $('#acct-err'); if (err) err.textContent = '';
  };

  window.doSignIn = function (e) {
    e.preventDefault();
    const email = ($('#si-email').value || '').trim();
    const pass = ($('#si-pass').value || '').trim();
    const name = ($('#si-name') && $('#si-name').value || '').trim();
    const err = $('#acct-err');
    const btn = $('#si-submit');
    if (!email || !pass) return false;
    btn.disabled = true; btn.textContent = 'One moment…';
    api(_mode === 'signup'
      ? { action: 'signup', email, password: pass, name }
      : { action: 'login', email, password: pass })
      .then(r => {
        if (r && r.token && r.user) {
          setSession({ email: r.user.email, name: r.user.name || name }, r.token);
          closeSheet();
          say('Signed in — welcome' + (r.user.name ? ', ' + r.user.name : '') + '!');
          pullData();
        } else if (r && r.offline) {
          // backend not configured → device-only fallback
          setSession({ email, name, local: true }, '');
          closeSheet(); say('Signed in on this device (account backend offline).');
        } else {
          if (err) err.textContent = (r && r.error) || 'Something went wrong — try again.';
          btn.disabled = false; btn.textContent = _mode === 'login' ? 'Sign in' : 'Create account';
        }
      })
      .catch(() => {
        // network failure (preview / offline) → device-only fallback
        setSession({ email, name, local: true }, '');
        closeSheet(); say('Signed in on this device (offline mode).');
      });
    return false;
  };

  window.signOut = function () {
    const token = getToken();
    if (token) api({ action: 'logout', token }).catch(() => {});
    setSession(null, '');
    closeSheet(); say('Signed out');
  };

  // ── password reset ──────────────────────────────
  // Step 1 — “Forgot password?” swaps the sheet to a send-link form.
  function openSheetShell(title, html) {
    const body = $('#sheet-body'); if (!body) return;
    $('#sheet-title').textContent = title;
    body.innerHTML = html;
    $('#sheet').classList.add('open'); $('#sheet-overlay').classList.add('open');
  }
  window.acctForgot = function () {
    const known = ($('#si-email') && $('#si-email').value || '').trim();
    openSheetShell('Reset your password',
      '<p class="lead-copy">Enter your account email and we’ll send a reset link. It works once and expires in 30 minutes.</p>' +
      '<form onsubmit="return doResetRequest(event)">' +
        '<div class="field"><label>Email</label><input id="rs-email" type="email" placeholder="you@example.com" required autocomplete="email" value="' + esc(known) + '"/></div>' +
        '<div class="acct-err" id="acct-err"></div>' +
        '<button class="sheet-btn" type="submit" id="rs-submit">Email me a reset link</button>' +
        '<p style="margin-top:12px;text-align:center;font-size:0.84rem"><a href="#" onclick="openSheet();return false;" style="color:var(--accent)">← Back to sign in</a></p>' +
      '</form>');
    return false;
  };
  window.doResetRequest = function (e) {
    e.preventDefault();
    const email = ($('#rs-email').value || '').trim();
    const btn = $('#rs-submit');
    if (!email) return false;
    btn.disabled = true; btn.textContent = 'Sending…';
    api({ action: 'reset-request', email })
      .then(() => {
        openSheetShell('Check your inbox',
          '<p class="lead-copy">If an account exists for <b>' + esc(email) + '</b>, a reset link is on its way. ' +
          'It expires in 30 minutes — check spam if you don’t see it.</p>' +
          '<button class="sheet-btn" onclick="closeSheet()">Done</button>');
      })
      .catch(() => {
        const err = $('#acct-err'); if (err) err.textContent = 'Couldn’t reach the server — try again in a minute.';
        btn.disabled = false; btn.textContent = 'Email me a reset link';
      });
    return false;
  };
  // Step 2 — the emailed link lands on /?reset=<token>: show a new-password form.
  function maybeResetFromLink() {
    let token = '';
    try { token = new URLSearchParams(location.search).get('reset') || ''; } catch (e) {}
    if (!token) return;
    openSheetShell('Choose a new password',
      '<p class="lead-copy">Set a new password for your PromptAI account. You’ll be signed in right away.</p>' +
      '<form onsubmit="return doResetConfirm(event)">' +
        '<div class="field"><label>New password</label><input id="rc-pass" type="password" placeholder="At least 8 characters" required minlength="8" autocomplete="new-password"/></div>' +
        '<div class="acct-err" id="acct-err"></div>' +
        '<button class="sheet-btn" type="submit" id="rc-submit">Save new password</button>' +
      '</form>');
    window._paiResetToken = token;
    // clean the token out of the address bar so it isn’t shared/bookmarked
    try { history.replaceState(null, '', location.pathname + location.hash); } catch (e) {}
  }
  window.doResetConfirm = function (e) {
    e.preventDefault();
    const pass = ($('#rc-pass').value || '').trim();
    const btn = $('#rc-submit');
    const err = $('#acct-err');
    if (!pass) return false;
    btn.disabled = true; btn.textContent = 'Saving…';
    api({ action: 'reset-confirm', token: window._paiResetToken || '', password: pass })
      .then(r => {
        if (r && r.token && r.user) {
          setSession({ email: r.user.email, name: r.user.name || '' }, r.token);
          closeSheet(); say('Password updated — you’re signed in.');
          pullData();
        } else {
          if (err) err.textContent = (r && r.error) || 'This link may have expired — request a new one.';
          btn.disabled = false; btn.textContent = 'Save new password';
        }
      })
      .catch(() => {
        if (err) err.textContent = 'Couldn’t reach the server — try again in a minute.';
        btn.disabled = false; btn.textContent = 'Save new password';
      });
    return false;
  };

  // validate an existing token in the background; drop it if expired
  function validate() {
    const token = getToken(), sess = getSession();
    if (!token || !sess || sess.local) return;
    api({ action: 'session', token }).then(r => {
      if (r && r.user) {
        setSession({ email: r.user.email, name: r.user.name || '' }, token);
      } else if (r && r.error && !r.offline) {
        setSession(null, '');
      }
    }).catch(() => {});
  }

  // ── public API ────────────────────────────────────────
  window.paiAccount = { record, unrecord, getSession, getData, pullData, renderUser };

  // ── boot ──────────────────────────────────────────────
  function boot() { renderUser(); validate(); maybeResetFromLink(); }
  if (document.readyState === 'loading') document.addEventListener('DOMContentLoaded', boot); else boot();
})();
