// functions/feed.xml.js
// Cloudflare Pages Function — serves the live RSS feed DIRECTLY at the
// public /feed.xml route.
//
// Same fix as sitemap.xml.js: the old `_redirects` rule
// (`/feed.xml  /feed  200`) was a 200 proxy rewrite pointing at a Pages
// Function, which Cloudflare cannot resolve (proxy rewrites only hit
// static assets) — so it 404'd. Mapping this Function file to the
// `/feed.xml` route serves it natively.
//
// Single source of truth: the generator lives in ./feed.js
// (also reachable at /feed for backwards-compat).

export { onRequest } from './feed.js';
