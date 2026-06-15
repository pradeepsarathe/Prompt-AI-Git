# Deploy bundle — 2026-06-15c  (9 undeployed files)

These 9 files are the **only** files where the working tree is ahead of the
live repo `pradeepsarathe/Prompt-AI-Git@main`. Every other source file and all
Cloudflare `functions/` are already byte-identical to the repo — verified by a
full-tree size+content diff this session.

Last session's work (and a little before it) was committed to the working tree
**but never pushed**, so production is still serving the older versions.

## Push these to the repo root (overwrite same-named files):

| File | vs repo | what's new |
|------|---------|------------|
| `sw.js` | `pai-v10` → `pai-v11` | cache version bump (required so returning users pick up the new JS/CSS/HTML) |
| `index.html` | +112 B | — |
| `glossary.html` | +893 B | live term filter, search-clear (✕), "Save as PDF", `?q=` deep-link, count row |
| `prompts.html` | +1638 B | search-clear (✕), `?q=` deep-link, "N of 50" count row, `syncUrl()` |
| `prompts-hindi.html` | +143 B | — |
| `methodology.html` | +2848 B | full multi-theme (promptai/slate/dark), skip-link, back-to-top, theme-color |
| `privacy.html` | +3014 B | multi-theme + back-to-top parity |
| `terms.html` | +3005 B | multi-theme + back-to-top parity |
| `pai-chrome.css` | +1590 B | chrome CSS to match the above |

## How to deploy
Cloudflare Pages auto-deploys on push to `main`. Either:
- **From a local clone:** drop these 9 files in at the repo root, `git add` them,
  commit, `git push`; or
- **Just push the whole working tree** — only these 9 files differ, so a full
  push produces exactly this changeset.

No env / KV / cron changes needed (`STATS` KV + `CRON_SECRET` already exist).

## Verify after deploy
1. `view-source:https://promptai.in/sw.js` → `VERSION = 'pai-v11'`.
2. `https://promptai.in/glossary.html` → filter box narrows the 16 terms, ✕ clears,
   "Save as PDF" prints clean; `…/glossary.html?q=token` pre-filters.
3. `https://promptai.in/prompts.html?q=editor` → search prefilled + ✕ visible.
4. `https://promptai.in/methodology.html`, `/privacy.html`, `/terms.html` → theme
   switch works (blue/slate/dark) and the back-to-top button appears past ~480px.

(Supersedes the earlier `_deploy-2026-06-15b/` folder, which was incomplete —
it carried two already-deployed JS files and was missing 7 of the files above.)
