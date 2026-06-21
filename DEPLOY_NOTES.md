# Deploy: Swipe is now the landing page

Drop these files into the repo root of `pradeepsarathe/Prompt-AI-Git` (same paths),
commit, and push to `main`. Cloudflare Pages auto-deploys.

## What changed
- **`index.html`** → now the Swipe app (the new landing page at `promptai.in/`).
  Brand logo stays on Swipe (`/`); "Full site" + the two overlay links open `home.html`.
  Added canonical/OG tags for the homepage.
- **`home.html`** → NEW. The old full-platform homepage, moved off the root.
  Canonical/OG updated to `/home.html`. Its hash-based SPA routing works unchanged.
- **`swipe.html`** → refreshed to the latest Swipe code, canonical → `/`
  (keeps old `/swipe.html` bookmarks working without competing in search).
- **All other pages** (`archive`, `education`, `glossary`, `prompts`, `prompts-hindi`,
  `methodology`, `privacy`, `terms`, `404`, `promptai_google`, every `glossary/*` and
  `prompt/*` leaf) → every "home"/brand/nav link that pointed at `index.html`, `../index.html`,
  or `/` now points at `home.html` so the full site stays internally consistent.
- **`functions/lib/page.js`** → server-rendered page chrome (issues / topics / learn):
  brand, nav, CTA and 404 links repointed to `/home.html`.
- **`functions/_middleware.js`** → SSR home-headline injection now also fires on
  `/home.html` (so the full home keeps its crawler content). Swipe at `/` passes through
  untouched (no `<!--SSR:HOME-->` placeholder).

## Note
- `_redirects` was NOT changed. Swipe serves at `/` because it IS `index.html` — the most
  reliable approach on Cloudflare Pages (a `/ → /swipe.html` rewrite is unreliable since the
  static `index.html` wins).
- The homepage is now a JS app; its SEO text content is lighter than the old SPA home.
  The full briefing home still exists at `/home.html` and keeps SSR headlines.
