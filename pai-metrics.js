// pai-metrics.js — first-party funnel beacon (review #10: instrument the funnel).
//
// Counts a few LOW-VOLUME conversion events and POSTs them to /api/event via
// sendBeacon. Pageviews are intentionally NOT sent (Cloudflare Web Analytics
// already counts visits, and per-view KV writes would blow the budget).
//
// It self-wires WITHOUT touching the app: it wraps fetch + clipboard and
// delegates clicks, so no engine edits are needed. For anything it can't infer,
// call window.paiTrack('event_name') directly, or add data-ev="event_name" to
// an element. No cookies, no PII, first-party only.
(function () {
  'use strict';
  var sent0 = {};
  function track(name) {
    if (!name) return;
    try { navigator.sendBeacon('/api/event?n=' + encodeURIComponent(name)); }
    catch (e) { try { fetch('/api/event?n=' + encodeURIComponent(name), { method: 'POST', keepalive: true }); } catch (e2) {} }
  }
  // de-dupe bursts of the same event within 800ms (e.g. repeated summary fetches)
  function trackOnce(name) {
    var now = Date.now();
    if (sent0[name] && now - sent0[name] < 800) return;
    sent0[name] = now;
    track(name);
  }
  window.paiTrack = track;

  // ── infer "story opened" + "subscribe completed" by watching fetch ──
  if (window.fetch) {
    var _fetch = window.fetch;
    window.fetch = function (input, init) {
      try {
        var u = typeof input === 'string' ? input : (input && input.url) || '';
        if (/\/api\/summarize/.test(u)) trackOnce('story_open');
        else if (/\/api\/explain/.test(u)) trackOnce('paper_explain');
        if (/\/subscribe(\?|$)/.test(u)) {
          return _fetch.apply(this, arguments).then(function (res) {
            try { if (res && res.ok) trackOnce('subscribe_success'); } catch (e) {}
            return res;
          });
        }
      } catch (e) {}
      return _fetch.apply(this, arguments);
    };
  }

  // ── infer "prompt copied" by watching the clipboard ──
  try {
    if (navigator.clipboard && navigator.clipboard.writeText) {
      var _wt = navigator.clipboard.writeText.bind(navigator.clipboard);
      navigator.clipboard.writeText = function (t) { trackOnce('prompt_copy'); return _wt(t); };
    }
  } catch (e) {}

  // ── click delegation for the things we can name by selector ──
  document.addEventListener('click', function (e) {
    var el = e.target && e.target.closest ? e.target : null;
    if (!el) return;
    var ev = el.closest('[data-ev]');
    if (ev) { track(ev.getAttribute('data-ev')); return; }
    if (el.closest('#subscribe-btn, .subscribe-cta')) { track('subscribe_click'); return; }
    var a = el.closest('a[href]');
    if (a) {
      var href = a.getAttribute('href') || '';
      if (/twitter\.com\/intent|linkedin\.com\/share|x\.com\/intent/.test(href)) track('share_click');
      else if (/\/issue\//.test(href) && /sample/i.test(a.textContent || '')) track('sample_click');
    }
  }, true);
})();
