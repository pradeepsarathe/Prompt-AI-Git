# NEXT SESSION

# NEXT SESSION

## State (2026-06-14, latest 2) — Review action pack: 15 changes shipped (front-end + SEO)
Implemented 15 self-contained items from `PromptAI Full Platform Review - June 14.html`
(no keys/binaries/accounts needed). Working tree only — push to repo to deploy.
**Bumped `sw.js` VERSION → `pai-v5`** (cached static assets changed shape — required so
returning users get the new JS/CSS).

Changes & files:
1. **WCAG AA contrast** — darkened `--text-3` in every theme: `index.html`,
   `pai-chrome.css`, `functions/lib/page.js`, `404.html`, `promptai_google.html`.
2. **Modal a11y** — aria-labels on Save/Like/Post/Share/Copy emoji buttons (`index.html`).
3. **CLS** — explicit width/height on story card thumbnails (`pai-google-ui.js`).
4. **i18n a11y** — set `<html lang>` on translate switch (`pai-translate.js`).
5. **First-run interest picker** — `#onboard` overlay + `paiMaybeOnboard/Save/Skip`
   (`index.html` markup+CSS, `pai-google-ui.js`). Persists `pai_interests`/`pai_onboarded`.
6. **For-you cold-start fixed** — `topInterests()` seeds from chosen interests (weight 4);
   note now "Tuned to your interests · …".
7. **Modal CTA rebalance** — "Read full article" no longer auto-closes the modal (opens
   in new tab; reader returns to "Up next").
8. **Unified search** — homepage `SearchAction` schema target → `/?q={search_term_string}`.
9. **`?q=` handled in-app** on boot (`pai-google-ui.js`).
10. **Richer issue schema** — `Article` → `NewsArticle` + image/author/publisher-logo/
    dateModified/mainEntityOfPage (`functions/issue/[date].js`).
11. **BreadcrumbList JSON-LD** auto-emitted for ALL server pages from `breadcrumbs`
    (`functions/lib/page.js`) — covers issues/learn/topic.
12. Issue meta descriptions already unique (verified) + enhanced via #10.
13. **Editorial Standards / methodology page** (`methodology.html`) — E-E-A-T: sourcing,
    AI-summary disclosure, independence, corrections, contact. Added to `sitemap.js`,
    footers (`index.html`, server `page.js`).
14. **Internal linking** — methodology interlinks + breadcrumb schema + footer links.
15. **Reading streak** — `renderStreak()` adds a streak row to the rail stats (≥2 days).

Verified in preview (after SW cache refresh): picker shows, interests seed For-you,
search routes, no console errors. NOTE: stale-while-revalidate means a hard-refresh or
the `pai-v5` bump is needed to see new JS — that's expected SW behavior.

Still NOT done (needs you / bigger lifts): CSP enforce (refactor inline handlers),
web push (VAPID keys), self-host fonts (binaries), original editorial content, real
affiliate/sponsor deals, embeddings search, localized indexable pages.

## State (2026-06-14, latest) — "Up next" in-modal next-story loop (front-end only)
Built the missing **next-story modal** loop (was on the punch list). When any
article opens, the modal now shows an **"Up next"** rail of 2–3 related reads;
clicking one swaps the modal content in place (records history, bumps read
count, regenerates a fresh rail, resets scroll to top) so readers keep going
without closing the modal. Files touched (working tree only, no backend/env):
- `index.html` — `.modal-next`/`.m-next-*` CSS + `<div id="m-next">` in modal body.
- `pai-google-ui.js` — `relatedStories(cur,n)` (ranks loaded news+blogs+papers by
  topic, source, title-keyword overlap, recency; mild already-read penalty;
  two-pass backfill so even a heavy returning reader gets a full rail) and
  `renderModalNext(cur)`; both wired into `openModal` + scrollTop reset. Fires a
  `next_story` funnel event (P.event). Falls back to hidden if <2 candidates.
Note: only renders on pages that load the UI engine (home `index.html`). Could
be ported to issue/archive pages later if wanted.

## State (2026-06-13, latest) — Research feed fix
`esig/Prompt ai - Research feed fix (arXiv parser + CSP) - 2026-06-13 - 4/`.
Research tab was empty (News fine). Cause: client fallback `legacyFetchPapers`
in `pai-feed-engine.js` only parsed RSS `<item>`; arXiv can serve Atom `<entry>`.
Fixed to parse both. Also added arXiv/proxy hosts to `_headers` CSP `connect-src`
(still Report-Only). Server parser (`feedlib.js`) already handled Atom.

## Earlier state — UI polish: footer + universal subscribe + summary
Front-end only, no backend/env changes. Bundle:
`esig/Prompt ai - Footer + universal subscribe + summary restyle - 2026-06-13 - 3/`
(also applied live in the working tree). Push folder contents to repo root.
- Footers already unified across all pages; added the standard footer to `404.html`.
- Weekly/Daily subscribe choice now on EVERY page's popover (was home-only);
  `pai-chrome.js` sends `frequency`. Selected option is now an obvious solid ✓
  pill (segmented control) — fixes the ambiguous toggle. `.freq-row` styles in
  `pai-chrome.css` + index inline.
- Article-modal AI summary restyled: serif on an accent-gradient panel
  (`.modal-text`); home "Today in 60 seconds" card matched.
- Touched: index.html, pai-chrome.css, pai-chrome.js, 404.html, prompts/
  education/archive/glossary/prompts-hindi.html, prompt/*(50), glossary/*(16).

## Earlier state — R34 Funnel + Learn AI + CSP BUILT & WIRED
The interrupted R34 batch is now **complete and ready to deploy**.
Deploy folder: `design/2026-06-13-r34-funnel-learn/deploy/` (+ its README).
Push the CONTENTS of that `deploy/` folder to the repo root.

### What R34 ships (10 items, all additive — nothing touches the 55KB UI engine)
NEW:
- `pai-metrics.js` — self-wiring funnel beacon (fetch/clipboard/click → /api/event)
- `functions/api/event.js` — low-volume conversion counter (STATS KV, 90-day TTL)
- `functions/metrics.js` — authed dashboard `/metrics?key=CRON_SECRET`
- `functions/api/csp-report.js` — CSP Report-Only sink (viewable in /metrics)
- `functions/lib/learnpaths.js` — 3 Learn paths (data)
- `functions/learn/index.js` — `/learn` hub
- `functions/learn/[slug].js` — `/learn/<slug>` per-path SEO pages (Course+HowTo JSON-LD, prev/next)
- `functions/lib/promptpicks.js` — "Prompt of the week" rotation

EDIT:
- `_headers` — CSP **Report-Only** (never blocks; reports → /api/csp-report)
- `functions/sitemap.js` — +/learn +3 slugs; EDU_LASTMOD → 2026-06-13
- `functions/issue/[date].js` — prev/next issue nav
- `functions/send-digest.js` — Prompt-of-the-week block (HTML + text)
- `functions/lib/page.js` — server shell loads the beacon
- `index.html` / `prompts.html` / `education.html` — load the beacon;
  education.html also interlinks its 3 path cards → /learn/<slug>

### Pending user actions for R34
1. Push `design/2026-06-13-r34-funnel-learn/deploy/` contents to repo root.
2. No new cron / env needed (STATS KV + CRON_SECRET already exist).
3. Verify: `/api/event?n=story_open` → 204; `/metrics?key=CRON_SECRET`;
   `/learn` + `/learn/use-ai-productively`; sitemap has 4 new URLs.
4. Watch `/metrics` "CSP" table ~2 weeks before considering CSP **enforce**.

## Earlier R33 state (2026-06-13) — Welcome Series + Win-back (LIVE in repo)
- `functions/lib/welcomelib.js`, `welcome-series.js`, `winback.js`,
  `e/open.js`; `confirm.js` enrols; `send-digest.js` embeds open pixel.
- Crons: DAILY 10:00 IST → /welcome-series; WEEKLY Thu 09:00 IST → /winback.

## Earlier R32 state (2026-06-13) — Growth pack (LIVE in repo)
- Prompt library 25 → 50; Hindi hub; share + per-page OG; llms.txt;
  weekly-report.js; sitemap updates.

## Remaining code blocks (not started — need keys/binaries or deep UI work)
- CSP **enforce** + HttpOnly cookie sessions (refactor inline handlers first)
- Web push (needs VAPID keys from user)
- Self-hosted fonts (needs font binaries)
- "For you" rail / next-story modal (deep 55KB UI-engine work — own session)
- D1 migration (long-term)
