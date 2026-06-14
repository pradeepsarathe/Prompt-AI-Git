// sw.js — PromptAI service worker (R10).
// Strategy:
//   • HTML + /api/* + data endpoints → network-first (fresh content), with
//     cache fallback so the briefing still opens offline.
//   • Static assets (js/css/images/fonts) → stale-while-revalidate.
// Bump VERSION whenever cached assets change shape.
const VERSION = 'pai-v6';
const STATIC = [
  '/', '/index.html',
  '/pai-feed-engine.js', '/pai-google-ui.js', '/pai-account.js', '/pai-translate.js',
  '/pai-chrome.css', '/pai-chrome.js',
  '/archive.html', '/education.html', '/prompts.html',
  '/manifest.webmanifest', '/icon-192.png', '/icon-512.png',
];

self.addEventListener('install', (e) => {
  e.waitUntil(caches.open(VERSION).then(c => c.addAll(STATIC)).catch(() => {}));
  self.skipWaiting();
});

self.addEventListener('activate', (e) => {
  e.waitUntil(
    caches.keys().then(keys => Promise.all(keys.filter(k => k !== VERSION).map(k => caches.delete(k))))
      .then(() => self.clients.claim())
  );
});

self.addEventListener('fetch', (e) => {
  const req = e.request;
  if (req.method !== 'GET') return;
  const url = new URL(req.url);
  if (url.origin !== location.origin) return; // never intercept third parties

  const isData = url.pathname.startsWith('/api/') || url.pathname === '/archive-data'
    || url.pathname === '/stats' || url.pathname === '/feed';
  const isHTML = req.mode === 'navigate' || (req.headers.get('accept') || '').includes('text/html');

  if (isData || isHTML) {
    // network-first
    e.respondWith(
      fetch(req).then(res => {
        if (res.ok) { const copy = res.clone(); caches.open(VERSION).then(c => c.put(req, copy)); }
        return res;
      }).catch(() => caches.match(req).then(hit => hit || (isHTML ? caches.match('/index.html') : Response.error())))
    );
    return;
  }

  // static: stale-while-revalidate
  e.respondWith(
    caches.match(req).then(hit => {
      const refresh = fetch(req).then(res => {
        if (res.ok) { const copy = res.clone(); caches.open(VERSION).then(c => c.put(req, copy)); }
        return res;
      }).catch(() => hit);
      return hit || refresh;
    })
  );
});
