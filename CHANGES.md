# CHANGES — deploy-2026-06-11-v2

One package, the whole punch list. Push the CONTENTS of this folder to the
repo root (it includes everything from the earlier deploy-2026-06-11 package
plus all of the R-items below). Then do ACTIONS_REQUIRED.md.

## Architecture
- **R1 — server-side feed aggregation.** New `/api/refresh-feeds` (cron, every
  30 min) fetches all sources server-side, classifies topics, generates the AI
  summary, snapshots the daily issue, merges the archive, writes one KV payload.
- **R2 — single sources module.** `functions/lib/sources.js` is now the ONLY
  feed list. send-digest, /feed, rss-proxy allow-list and the aggregator all
  derive from it. `functions/lib/feedlib.js` holds the shared fetch/parse code
  (one copy, was three).
- **R3 — archive races fixed.** The archive has a single writer (the
  aggregator). Browser POSTs to /archive-data are acknowledged but ignored.
- **R36 — 5,000-item cap removed.** Hot window (~4,000) + monthly cold
  segments `arch:seg:YYYY-MM` (`/archive-data?month=…`, `?months=1` to list).
- **R6 — first-visit request storm gone.** The browser makes ONE call to
  `/api/feeds` (was ~80 requests: 61 HN items + 17 feeds × proxy races).
  Legacy client-side path kept as automatic fallback.
- **R5 — CI.** `.github/workflows/ci.yml` syntax-checks functions + client JS,
  validates JSON, verifies relative imports resolve.

## SEO
- **R19 — server-rendered headlines.** `functions/_middleware.js` injects the
  AI summary + top headlines + latest papers as real HTML into `/` (replaced
  when the live app boots). Crawlers finally see content.
- **R21/R39 — rankable pages.** `/issue/<YYYY-MM-DD>` (daily briefing snapshot,
  Article JSON-LD), `/issues` (index), `/topic/{llms,agents,vision,robotics,policy,research,tools}`
  hubs. All server-rendered, no JS needed. Sitemap enumerates them.
- Digest email now links "Read this issue on the web" → its `/issue/…` page.

## Product
- **R29 — dark theme.** Follows system by default, manual override remembered
  (Dark + "Follow system" added to every page's theme menu; pre-paint script
  prevents flash; `color-scheme` set).
- **R30 — Workers AI.** "Today in 60 seconds" on the homepage (from the
  aggregator, cached in KV) + "✨ Explain this paper" in the arXiv modal
  (`/api/explain`, cached per-paper forever, rate-limited 20/h/IP).
  Both degrade silently without the AI binding.
- **R28 — save/like wired up.** Bookmark/heart on every card + in the modal,
  backed by the existing pai-account layer (localStorage + KV sync when
  signed in). Added `unrecord` (un-save/un-like).
- **R31 — prompt library.** `prompts.html` + `prompts-data.js` — 25 seeded
  prompts across Writing/Coding/Research/Marketing/Learning/Productivity,
  category filters, copy buttons. In the tab bar + footer of every page.
- **R34 batch (2026-06-13) — funnel + Learn AI + CSP.** First-party funnel
  beacon `pai-metrics.js` → `/api/event` (STATS KV) + authed `/metrics`
  dashboard; CSP **Report-Only** in `_headers` → `/api/csp-report`; per-path
  Learn AI pages `/learn` + `/learn/<slug>` (Course+HowTo JSON-LD) from
  `lib/learnpaths.js`, wired into sitemap + interlinked from education.html;
  issue prev/next nav; "Prompt of the week" in the digest. Deploy bundle:
  `design/2026-06-13-r34-funnel-learn/deploy/`.
- **R34 — view key renamed** learn → deepdives (`#learn` links still work).
- **R25 — focus trap** in modal + sign-in sheet (Tab cycles inside).
- **R35 — tools.json** with `lastReviewed` + per-tool `added` dates; UI loads
  it at runtime (embedded list = fallback).

## Newsletter
- **R17 — HMAC-signed unsubscribe** links (`&sig=`); legacy unsigned links now
  require one confirm click instead of instantly unsubscribing strangers.
- **R32 — honest social proof.** Subscriber count (rounded to 25) shown on
  subscribe forms only once ≥100 real subscribers; "Read a sample issue" link.
- **R38 — growth footer** in the digest: forward CTA, share-on-X, web version.
- **R42 — sponsor slot**: `SPONSOR_HTML` env var (email) + hidden
  `#sponsor-panel` (site). Nothing renders until you activate them.
- **R43 — affiliate-ready links**: `?ref=promptai` on tool links; `aff` field
  in tools.json for real affiliate URLs later.

## Ops / misc
- **R9/R41 — `/health`**: public ok/stale check (for UptimeRobot) + full
  authed report (bindings, last runs, subscriber counts).
- **R10 — PWA**: manifest + icons + service worker (offline shell,
  network-first content).
- **R33 — stats panel** shows content stats (stories/papers this week,
  sources) instead of vanity visitor counters. Visits still recorded.
- **R40 — Cloudflare Web Analytics** snippet ready (commented; needs token).
- **R8** — `display=swap` fonts already in place; preconnects tidied.

## NOT done (deliberately)
- D1 migration (kept KV per your call), payments/Pro tier, R22/R37-style
  external account changes beyond the dashboard steps in ACTIONS_REQUIRED.
