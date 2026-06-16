# Deploy bundle — 2026-06-16d  (R-next-4: slate default + favorites + mobile-perf)

Bumps `sw.js` → **pai-v15**. All client-side. Builds on deployed `pai-v14`.

This batch touches **nearly every page** (the slate default + the font optimization are
site-wide), so the bundle mirrors the live tree. Push the whole thing to the repo root.

## What changed

### A. Slate & teal = the default appearance  (user request)
"Slate & teal" already existed as a theme (warm paper canvas `#f7f5f1`, deep-teal accent
`#0f766e`). It is now the **default for visitors with no saved preference** — the per-page
pre-paint script and `pai-chrome.js` boot now fall back to `slate` instead of `auto`.
Anyone can still pick Briefing white / PromptAI blue / Dark / Follow-system from the
Appearance menu; an explicit choice is remembered as before. The static `theme-color` meta
on every page was aligned to `#f7f5f1` so the mobile address bar doesn't flash blue first.

### B. Prompt-library "Save" / favorites system  (new)
1. **★ Save toggle on every library card** — persists in `localStorage.pai_fav_prompts`.
2. **"★ Saved (N)" filter chip** — appears once you have favorites; filters the grid to them.
3. **Filled-star state** on saved cards.
4. **Prompt detail pages get a ★ Save button** in the action row (via `pai-chrome.js`),
   reading/writing the **same store** — save on the library, it shows saved on the page,
   and vice-versa.
5. **`f` keyboard shortcut** saves/unsaves on a detail page (pairs with `c` = copy).
6. Favorites are deep-linkable (`prompts.html?fav=1`).

### C. Library polish
7. **"↗ Gemini" link on every card** (copies prompt → opens Gemini), so cards now offer
   ChatGPT · Claude · Gemini — parity with the detail pages.
8. **Press `/`** to jump to the search box; **Esc** clears it.
9. **"Clear" reset** in the count row whenever a search / category / saved filter is active.

### D. Mobile performance  (user flagged PageSpeed mobile)
10. **Google Fonts no longer render-blocking** on any page — switched to
    `preload as=style` + `media="print" onload="this.media='all'"` swap, with a
    `<noscript>` fallback. With `display=swap` already set, text paints immediately in
    fallback fonts and swaps in Roboto when ready. This removes the main
    "Eliminate render-blocking resources" item on the homepage.
11. Removed a **duplicate `images.weserv.nl` preconnect** on the homepage.
    (Feed images were already good: weserv→webp, `loading=lazy`, `decoding=async`,
    `fetchpriority=high` on the lead, explicit width/height — left as-is.)

## Files to push
- `prompt/` (all 50) · `glossary/` (all 16)
- `index.html`, `prompts.html`, `prompts-hindi.html`, `glossary.html`, `education.html`,
  `archive.html`, `methodology.html`, `404.html`, `privacy.html`, `terms.html`
- `pai-chrome.js`, `sw.js`

## Verify after deploy
1. `view-source:/sw.js` → `pai-v15`.
2. Open the site in a fresh/incognito window → it defaults to **slate & teal** (warm canvas,
   teal accents); the Appearance menu still switches themes and remembers the pick.
3. `/prompts.html` → each card has a ★ in the top-right and a ↗ Gemini link; star one →
   a "★ Saved (N)" chip appears and filters; `/` focuses search; Clear resets.
4. Any `/prompt/<slug>` → a **★ Save** button sits in the action row; pressing `f` toggles
   it; the state matches what you saved on the library.
5. Re-run PageSpeed mobile → "Eliminate render-blocking resources" should no longer flag the
   fonts stylesheet; FCP/LCP improve.

> Preview note: the in-app preview's service worker serves the cached `pai-chrome.js` until
> `pai-v15` reinstalls, so the detail-page Save button shows after deploy / hard-reload.
> Everything in `prompts.html` (favorites, Gemini, search) and the slate default + font
> changes are inline and render immediately.
