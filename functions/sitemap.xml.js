// functions/sitemap.xml.js
// Cloudflare Pages Function — serves the dynamic sitemap DIRECTLY at
// the public /sitemap.xml route.
//
// Why this file exists:
//   Previously /sitemap.xml was wired via a `_redirects` proxy rule
//   (`/sitemap.xml  /sitemap  200`). Cloudflare Pages only resolves 200
//   (proxy) rewrites to STATIC assets — never to a Pages Function — so
//   that rule fell through to 404.html. Naming a Function file
//   `sitemap.xml.js` maps it to the `/sitemap.xml` route natively, with
//   no redirect and no stale static file shadowing it.
//
// Single source of truth: the generator still lives in ./sitemap.js
// (also reachable at /sitemap for backwards-compat).

export { onRequest } from './sitemap.js';
