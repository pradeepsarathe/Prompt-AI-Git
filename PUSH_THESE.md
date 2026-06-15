# Deploy bundle — 2026-06-16  (R-next: 15 self-contained front-end changes)

Builds on the now-deployed `_deploy-2026-06-15c` batch. All client-side / SEO —
no keys, binaries, or backend secrets. **Bumps `sw.js` → `pai-v12`** (cached JS/CSS
changed, so returning users need the bump).

## The 15 changes
1. **Modal action buttons → inline SVG icons** (Save/Like/Post/Share/Copy). Emoji
   glyphs (🔖❤️𝕏🔗) replaced with crisp currentColor SVGs; aria-labels kept.
2. **Article-modal reading-progress bar** — thin accent bar pinned to the top, fills
   as you scroll the reading modal.
3. **"~N min read" estimate** in the modal (derived from the summary, ~220 wpm).
4. **Keyboard-shortcuts help overlay** — press `?` anywhere (ignored while typing);
   site-wide via `pai-chrome.js` + inline on `index.html`.
5. **Web Share API** on the modal Copy button — native share sheet on mobile, falls
   back to clipboard (updates the button label, not the icon).
6. **`aria-pressed`** on the modal Save/Like toggles (screen-reader state).
7. **robots `max-image-preview:large, max-snippet:-1, max-video-preview:-1`** added on
   prompts, glossary, education, archive, methodology, privacy, terms, prompts-hindi
   (index already had it) — richer SERP snippets + Discover eligibility.
8. **BreadcrumbList JSON-LD** on `privacy.html` and `terms.html` (were missing it).
9. **`decoding="async"`** on the engine's content thumbnails; added explicit
   `width/height` to the visual-card image (`.vis-img`) to kill its CLS too.
10. **Global `scroll-padding-top`** (90px chrome / 120px home) so in-page anchors land
    below the sticky top bar.
11. **PWA manifest**: `description`, `lang`, `categories`, and app **shortcuts**
    (Latest news / Prompt library / Archive) for install long-press menus.
12. **Print stylesheet** already covered chrome+detail pages (last batch); the new
    `#kbd-help` overlay is print-hidden so it never bleeds into PDFs.
13. **sitemap.js** `lastmod` refresh — `EDU_LASTMOD` 06-13 → 06-16 (stale; education
    changed), legal/prompts/glossary/methodology bumped to the current edit dates.
14. **Reduced-motion** guard on the new progress-bar animation.
15. **`sw.js` → `pai-v12`.**

## Files to push (15) — overwrite at repo root (sitemap keeps its functions/ path)
index.html · pai-google-ui.js · pai-chrome.js · pai-chrome.css · manifest.webmanifest ·
sw.js · functions/sitemap.js · prompts.html · glossary.html · education.html ·
archive.html · methodology.html · privacy.html · terms.html · prompts-hindi.html

## How to deploy
Push these to the repo root (Cloudflare Pages auto-deploys on push to `main`).
No env / KV / cron changes.

## Verify after deploy
1. `view-source:/sw.js` → `pai-v12`.
2. Home → open any story → modal shows SVG action icons, a top **progress bar** that
   fills on scroll, and a **"⏱ N min read"** line; on mobile **Copy** opens the native
   share sheet.
3. Press **`?`** on any page → keyboard-shortcuts panel; `Esc` closes it.
4. `view-source:/privacy.html` → `BreadcrumbList` JSON-LD + rich `robots` meta.
5. Install the PWA → long-press the icon shows News / Prompts / Archive shortcuts.

> NOTE: in the in-app preview the service worker serves the **old cached** JS until
> `pai-v12` reinstalls — so the modal there may still show the old emoji buttons.
> That's expected SW behavior; the deployed files are correct (verified at source).
