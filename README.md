# Edit #3 — Footer consistency + universal subscribe + summary restyle (2026-06-13)

Push the contents of this folder to the repo root (paths mirror the repo).
**No backend / env changes.** Pure front-end (HTML/CSS/JS). First rule honoured:
nothing existing was removed or rewired — only additive styling + markup.

## What changed & why

### 1. Footer — same on every page, all links working
- Audited every live page: the static pages, prompt/* and glossary/* detail
  pages, and the server-rendered shell (`functions/lib/page.js`) **already share
  the identical 8-link footer** (Privacy · Terms · Prompts · Learn AI · Archive ·
  Issues · RSS · Unsubscribe) and every target resolves.
- The only outlier was **`404.html`** (had no site footer). Added the standard
  footer there, pinned to the bottom. Now truly universal.

### 2. Subscribe — universal Weekly/Daily choice + clear selected state
- **Before:** the home page showed a Weekly/Daily choice; every *other* page's
  Subscribe popover was just an email box ("subscribe"), and `pai-chrome.js`
  didn't send the frequency at all → inconsistent.
- **Now:** the Weekly · Tue / Daily choice appears in the Subscribe popover on
  **all** pages, with the same copy. Wired through `pai-chrome.js`
  (`doTopSubscribe` / `doRailSubscribe` now read the choice and POST
  `frequency` to `/subscribe`, which already stores it).
- **Clarity fix (the ambiguous toggle):** the freq control is now a proper
  segmented control — the **selected** option is a solid accent pill with a ✓
  and bold text; the unselected is a quiet outline. Native radio dots are
  hidden. Same treatment on the blue Briefing panel (selected = solid white
  pill + ✓). No more guessing which is picked.

### 3. AI summary — better font + gradient
- The per-story summary in the article modal (`.modal-text`) is now an
  editorial **serif** block on a subtle **accent gradient** panel with a soft
  border — much more readable and intentional than the old flat paragraph.
- The home "Today in 60 seconds" card (`.summary-card`) got the matching
  gradient treatment for consistency.

## Files in this bundle
- `index.html` — freq segmented-control CSS (+ dark-mode fix), summary gradient/serif, popover copy
- `pai-chrome.css` — `.freq-row` segmented-control styles (shared by all non-home pages)
- `pai-chrome.js` — frequency now read + sent on non-home pages
- `404.html` — standard site footer added
- `prompts.html`, `education.html`, `archive.html`, `glossary.html`, `prompts-hindi.html` — freq popover + unified copy
- `prompt/` (50 pages), `glossary/` (16 pages) — freq popover + unified copy

## Verify after deploy
- Every page footer is identical and all 8 links work (incl. 404).
- Open Subscribe on the home page AND any prompt/glossary page → identical
  Weekly/Daily control; the picked one is an obvious solid ✓ pill.
- Subscribe as "Daily" on a non-home page → `/subscribe` stores `frequency:daily`
  (check the toast + the subscriber record).
- Open any story → the AI summary sits in a gradient serif panel.

> Note: in the in-app live preview a hot-swapped stylesheet can briefly mis-render
> the `:has()` selected state; a normal page load (and production) renders it
> correctly — verified.
