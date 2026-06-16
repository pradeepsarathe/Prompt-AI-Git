# Deploy bundle — 2026-06-16c  (R-next-3: 10 changes, prompt-library + glossary utility)

Builds on the deployed `pai-v13` batch. All client-side / SEO — no keys or binaries.
**Bumps `sw.js` → `pai-v14`.**

Only **3 files** change — almost everything lands in the shared `pai-chrome.js`, which
all 50 `/prompt/<slug>` and 16 `/glossary/<slug>` pages already load, so no per-page
HTML edits were needed.

## The 10 changes
1. **Prompt pages — `[bracketed]` placeholders are highlighted** in the prompt box
   (accent chips) so it's obvious what to replace. Copy text is unchanged (round-trips).
2. **Prompt pages — "N blanks to fill" badge** next to Copy, auto-derived from the unique
   placeholders (hidden when there are none).
3. **Prompt pages — press `c` to copy** the prompt (ignored while typing in a field).
4. **Prompt pages — the category breadcrumb is now a link** to the filtered library
   (`/prompts.html?cat=<Category>`) — real internal linking.
5. **Glossary pages — a share row** (X · LinkedIn · WhatsApp · Copy link), parity with the
   prompt pages, which glossary pages previously lacked.
6. **Glossary pages — "🔊 Listen"** reads the definition aloud (Web Speech; toggles to Stop;
   auto-stops on navigate; hidden if unsupported).
7. **prompts.html — "Recently used" rail** (localStorage): the prompts you copied / opened,
   as quick chips, with a Clear button. Hidden until you use one.
8. **prompts.html — ItemList JSON-LD extended 25 → all 50 prompts** (richer CollectionPage
   structured data for the full library).
9. **prompts.html cards — "↗ Claude" open link** added next to "↗ ChatGPT" (both prefill
   the prompt; both record into the Recently-used rail).
10. **`sw.js` → `pai-v14`.**

## Files to push (3)
`pai-chrome.js` · `prompts.html` · `sw.js`

## How to deploy
Push these 3 to the repo root. Cloudflare auto-deploys on push to `main`.
No env / KV / cron changes.

## Verify after deploy
1. `view-source:/sw.js` → `pai-v14`.
2. Any `/prompt/<slug>` → the `[bracketed]` parts are highlighted, an "N blanks to fill"
   badge sits by Copy, pressing `c` copies, and the "Coding" (etc.) breadcrumb links to
   `/prompts.html?cat=Coding`.
3. Any `/glossary/<slug>` → a **🔊 Listen** button + a **share row** under the answer.
4. `/prompts.html` → cards show **↗ ChatGPT** and **↗ Claude**; after you copy/open one, a
   **Recently used** rail appears at the top. Rich Results test → CollectionPage ItemList
   with 50 items.

> As always, the in-app preview's service worker serves the cached `pai-chrome.js` until
> `pai-v14` reinstalls, so the prompt/glossary enhancements show in preview only after
> deploy / hard-reload. The `prompts.html` changes (rail, Claude link, JSON-LD) are inline
> in the network-first HTML and render immediately. All logic verified at source + by
> executing it against the live DOM this session.
