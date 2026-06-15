# Deploy bundle — 2026-06-16b  (R-next-2: 15 changes, prompt-library + sharing + a11y/SEO)

Builds on the deployed `pai-v12` batch. All client-side / SEO — no keys or binaries.
**Bumps `sw.js` → `pai-v13`.**

## The 15 changes
1. **"Open in ChatGPT / Claude / Gemini"** on all **50 prompt detail pages** — deep-links
   that prefill the prompt (`chatgpt.com/?q=`, `claude.ai/new?q=`; Gemini = copy + open,
   since it has no prefill param).
2. **prompts.html cards: "↗ Open in ChatGPT"** quick-open on every card.
3. **Glossary (16 pages): "✨ Ask ChatGPT to explain this further"** deep-link built from
   the term.
4. **Home article modal: WhatsApp + Telegram share** added (parity with prompt pages);
   share moved to a dedicated icon row.
5. **Modal "🔊 Listen"** — reads the AI summary aloud via the Web Speech API (toggles
   to Stop; auto-stops on close; hidden if unsupported).
6. **Semantic `<time datetime>`** for the modal timestamp (a11y + SEO).
7. **FAQPage JSON-LD on methodology.html** (independence / AI use / sourcing / corrections)
   — eligible for FAQ rich results.
8. **Organization schema** gains `foundingDate` + `contactPoint` (E-E-A-T).
9. **Focus trap** in the home article modal (Tab cycles within).
10. **Offline banner** — site-wide toast when `navigator.onLine` is false (pai-chrome.js
    for chrome/detail pages, inline on home).
11. **LCP**: `fetchpriority="high"` + explicit dims on the lead/hero image.
12. **Preconnect** to `images.weserv.nl` (the image proxy on the critical path).
13. **In-modal next-story shortcut** — `n` / `→` opens the first "Up next" read; added to
    the `?` keyboard-help overlay.
14. **prompts.html "🎲 Surprise me"** — opens a random prompt.
15. **`sw.js` → `pai-v13`.**

## Files to push (73)
index.html · pai-google-ui.js · pai-chrome.js · pai-chrome.css · methodology.html ·
prompts.html · sw.js · **prompt/** (50 files) · **glossary/** (16 files)

## How to deploy
Push these to the repo root, preserving the `prompt/` and `glossary/` subfolders.
Cloudflare auto-deploys on push to `main`. No env / KV / cron changes.

## Verify after deploy
1. `view-source:/sw.js` → `pai-v13`.
2. Any `/prompt/<slug>` → an **Open in: ChatGPT · Claude · Gemini** row; ChatGPT/Claude
   open with the prompt prefilled.
3. `/prompts.html` → each card has **↗ Open in ChatGPT**; header has **🎲 Surprise me**.
4. `/glossary/<term>` → **✨ Ask ChatGPT to explain this further**.
5. Home → open a story → modal has a **🔊 Listen** button and a **WhatsApp/Telegram**
   share row; press `n` to jump to the next "Up next" read.
6. Google Rich Results test on `/methodology.html` → FAQPage detected.

> As before, the in-app preview's service worker serves cached JS until `pai-v13`
> reinstalls, so home-modal engine wiring (WhatsApp/Telegram hrefs, `<time>`, next-key)
> shows fresh only after deploy/hard-reload. Prompt/glossary deep-links are inline HTML
> and render fresh immediately. All verified at source.
