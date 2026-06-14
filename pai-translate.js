/* ════════════════════════════════════════════════════════════════════
   PromptAI — self-contained site translator
   Translates ALL visible text (static + live feed) into the chosen
   language via Google's public gtx endpoint (CORS-enabled), with a
   persistent cache and a MutationObserver for content loaded later.
   Exposes window.paiSetLang(code). No backend, no widget.
   ════════════════════════════════════════════════════════════════════ */
(function () {
  'use strict';
  var ENDPOINT = 'https://translate.googleapis.com/translate_a/single?client=gtx&dt=t&sl=auto&tl=';
  var SKIP = { SCRIPT:1, STYLE:1, NOSCRIPT:1, CODE:1, PRE:1, TEXTAREA:1, OPTION:1 };
  var curLang = 'en';
  try { curLang = localStorage.getItem('pai_lang') || 'en'; } catch (e) {}
  var origMap = new WeakMap();   // textNode -> original English string
  var cache = {};                // lang -> { original: translated }
  var observer = null, busy = false;

  function loadCache(lang) {
    if (cache[lang]) return cache[lang];
    try { cache[lang] = JSON.parse(localStorage.getItem('pai_tr_' + lang) || '{}'); } catch (e) { cache[lang] = {}; }
    return cache[lang];
  }
  function saveCache(lang) { try { localStorage.setItem('pai_tr_' + lang, JSON.stringify(cache[lang])); } catch (e) {} }

  function translatable(s) {
    if (!s) return false;
    var t = s.trim();
    if (t.length < 2) return false;
    return /[A-Za-z\u00C0-\u024F]/.test(t);   // must contain latin letters
  }

  function collect(root) {
    var out = [];
    var walker = document.createTreeWalker(root, NodeFilter.SHOW_TEXT, {
      acceptNode: function (node) {
        var p = node.parentNode;
        if (!p || SKIP[p.nodeName]) return NodeFilter.FILTER_REJECT;
        if (p.nodeName === 'svg' || (p.namespaceURI && p.namespaceURI.indexOf('svg') > -1)) return NodeFilter.FILTER_REJECT;
        if (p.closest && p.closest('[data-no-translate]')) return NodeFilter.FILTER_REJECT;
        if (!translatable(node.nodeValue)) return NodeFilter.FILTER_REJECT;
        return NodeFilter.FILTER_ACCEPT;
      }
    });
    var n; while ((n = walker.nextNode())) out.push(n);
    return out;
  }

  function fetchChunk(group, lang, c) {
    var q = group.join('\n');
    return fetch(ENDPOINT + lang + '&q=' + encodeURIComponent(q))
      .then(function (r) { return r.json(); })
      .then(function (j) {
        var translated = (j[0] || []).map(function (x) { return x[0]; }).join('');
        var parts = translated.split('\n');
        if (parts.length === group.length) { group.forEach(function (o, i) { c[o] = parts[i]; }); return; }
        // counts mismatch → translate each individually
        return group.reduce(function (chain, o) {
          return chain.then(function () {
            if (o in c) return;
            return fetch(ENDPOINT + lang + '&q=' + encodeURIComponent(o))
              .then(function (r) { return r.json(); })
              .then(function (jj) { c[o] = (jj[0] || []).map(function (x) { return x[0]; }).join(''); })
              .catch(function () { c[o] = o; });
          });
        }, Promise.resolve());
      })
      .catch(function () { group.forEach(function (o) { if (!(o in c)) c[o] = o; }); });
  }

  function translateStrings(strings, lang) {
    var c = loadCache(lang);
    var seen = {}, need = [];
    strings.forEach(function (s) { if (!(s in c) && !seen[s]) { seen[s] = 1; need.push(s); } });
    if (!need.length) return Promise.resolve(c);
    var chunks = [], cur = [], len = 0;
    need.forEach(function (s) {
      if (len + s.length > 1000 && cur.length) { chunks.push(cur); cur = []; len = 0; }
      cur.push(s); len += s.length + 1;
    });
    if (cur.length) chunks.push(cur);
    return chunks.reduce(function (chain, g) { return chain.then(function () { return fetchChunk(g, lang, c); }); }, Promise.resolve())
      .then(function () { saveCache(lang); return c; });
  }

  function applyTo(nodes, lang) {
    if (!nodes.length) return Promise.resolve();
    var strings = nodes.map(function (n) {
      var o = origMap.get(n); if (o === undefined) { o = n.nodeValue; origMap.set(n, o); }
      return o.trim();
    });
    return translateStrings(strings, lang).then(function (c) {
      nodes.forEach(function (n) {
        var o = origMap.get(n), key = o.trim(), tr = c[key];
        if (tr && tr !== key) n.nodeValue = o.replace(key, tr);
      });
    });
  }

  function startObserver(lang) {
    if (observer) observer.disconnect();
    var pending = [];
    observer = new MutationObserver(function (muts) {
      muts.forEach(function (m) {
        (m.addedNodes || []).forEach(function (node) {
          if (node.nodeType === 3) { if (translatable(node.nodeValue)) pending.push(node); }
          else if (node.nodeType === 1) { pending.push.apply(pending, collect(node)); }
        });
      });
      if (pending.length) {
        clearTimeout(observer._t);
        observer._t = setTimeout(function () { var batch = pending; pending = []; applyTo(batch, lang); }, 350);
      }
    });
    observer.observe(document.body, { childList: true, subtree: true });
  }

  function translatePage(lang) {
    if (!lang || lang === 'en') return Promise.resolve();
    if (busy) return Promise.resolve(); busy = true;
    document.documentElement.setAttribute('lang', lang);
    return applyTo(collect(document.body), lang).then(function () { startObserver(lang); busy = false; });
  }

  // public API — called by the language popover (setLang → paiSetLang)
  window.paiSetLang = function (code) {
    try { localStorage.setItem('pai_lang', code); } catch (e) {}
    if (!code || code === 'en') { location.reload(); return; }   // revert = reload to original
    curLang = code;
    // Reflect the active language on the document so screen readers and search
    // engines announce/treat the content correctly (a11y + i18n correctness).
    try { document.documentElement.setAttribute('lang', code); } catch (e) {}
    if (window.toast) window.toast('Translating…');
    translatePage(code).then(function () { if (window.toast) window.toast('✓ Translated'); });
  };

  function boot() {
    if (curLang && curLang !== 'en') {
      try { document.documentElement.setAttribute('lang', curLang); } catch (e) {}
      translatePage(curLang);
    }
  }
  if (document.readyState === 'loading') document.addEventListener('DOMContentLoaded', boot); else boot();
})();
