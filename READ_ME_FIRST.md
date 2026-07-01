# Sitemap / feed 404 fix — files to push to Prompt-AI-Git

Fixes GET /sitemap.xml (and /feed.xml) returning 404.

## Apply to the repo root, preserving paths:

ADD/REPLACE these files (folder structure matters):
  functions/sitemap.xml.js   (new)
  functions/feed.xml.js      (new)
  _redirects                 (replace existing)

DELETE from repo root:
  sitemap.xml   (stale static file — shadows the Function)
  feed.xml      (stale static file — shadows the Function)

## Why
The old _redirects used 200 proxy rewrites (/sitemap.xml -> /sitemap,
/feed.xml -> /feed) pointing at Pages Functions. Cloudflare Pages only
resolves 200 rewrites to STATIC assets, never to Functions, so they fell
through to 404.html. Naming the Function files after the exact public
route (sitemap.xml.js, feed.xml.js) serves them natively. The stale
static sitemap.xml/feed.xml must be deleted or they shadow the Functions.

## After deploy
1. Load https://promptai.in/sitemap.xml — should return XML, not 404.
2. Load https://promptai.in/feed.xml — should return RSS XML.
3. Google Search Console -> Sitemaps -> submit https://promptai.in/sitemap.xml
4. Request Indexing on the homepage.
