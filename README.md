# R34 — Funnel instrumentation + Learn AI pages + CSP (deploy bundle)

Push **the contents of this `deploy/` folder to the repo root** of
`pradeepsarathe/Prompt-AI-Git` (default branch). Cloudflare Pages auto-deploys.
Paths here mirror the repo, so it's a straight overlay — no moves needed.

## What's in this bundle

### New files
| Path | What it does |
|---|---|
| `functions/api/event.js` | `POST/GET /api/event?n=<name>` — first-party funnel counter. Counts only low-volume conversion events to `ev:<date>:<name>` in **STATS KV** (90-day TTL). No PII, no cookies. |
| `pai-metrics.js` | Self-wiring client beacon. Wraps fetch + clipboard and delegates clicks to infer `story_open`, `subscribe_*`, `prompt_copy`, `share_click`, etc., and `sendBeacon`s them to `/api/event`. Pageviews intentionally NOT sent (Cloudflare Web Analytics already does that). |
| `functions/metrics.js` | `GET /metrics?key=CRON_SECRET` — authed internal dashboard. Shows the subscribe funnel, all event totals, by-day table, recent CSP report-only violations and cron run-state. `noindex`, not linked publicly. |
| `functions/api/csp-report.js` | `POST /api/csp-report` — sink for CSP **Report-Only** violations. Aggregates by directive + keeps a rolling 25-sample list (viewable in `/metrics`). |
| `functions/lib/learnpaths.js` | Single source of truth for the 3 Learn AI paths (data only). |
| `functions/learn/index.js` | `GET /learn` — hub page (CollectionPage JSON-LD) linking the 3 paths. |
| `functions/learn/[slug].js` | `GET /learn/<slug>` — per-path SEO page with Course + HowTo + BreadcrumbList JSON-LD and prev/next. Slugs: `use-ai-productively`, `build-ai-applications`, `research-ai-systems`. |
| `functions/lib/promptpicks.js` | Curated "Prompt of the week" rotation (deterministic by ISO week). |

### Edited files
| Path | Change |
|---|---|
| `_headers` | Added **`Content-Security-Policy-Report-Only`** (never blocks — only reports to `/api/csp-report`). Policy mirrors current usage; tighten later before switching to enforce. |
| `functions/sitemap.js` | Adds `/learn` + the 3 `/learn/<slug>` URLs; `EDU_LASTMOD` → `2026-06-13`. |
| `functions/issue/[date].js` | Added prev/next issue navigation (older ← → newer). |
| `functions/send-digest.js` | Added "🧰 Prompt of the week" block (HTML + plaintext) to the email. |
| `functions/lib/page.js` | Server-rendered shell now loads `/pai-metrics.js`. |
| `index.html`, `prompts.html`, `education.html` | Load `pai-metrics.js`. `education.html` also interlinks its 3 path cards → the new `/learn/<slug>` pages ("Open the full guide →"). |

## Required after deploy
1. **STATS KV** binding must already exist (it does — same one stats/open use). `/api/event`, `/api/csp-report` and `/metrics` all use it.
2. `CRON_SECRET` env var must be set (already is) — gates `/metrics`.
3. Nothing new to schedule. POTW rides the existing digest cron.

## Verify
- `GET /api/event?n=story_open` → `204`, then `GET /metrics?key=<CRON_SECRET>` shows the count.
- Visit `/learn`, `/learn/use-ai-productively` → real pages with breadcrumbs + prev/next.
- `/sitemap.xml` includes the 4 new learn URLs.
- Open a story / copy a prompt on the live site, then check `/metrics` after a minute.
- CSP: nothing should break (Report-Only). Watch `/metrics` "CSP" table for a couple of weeks before considering enforce.

## NOT in this batch (need keys/binaries or touch the 55KB UI engine)
- Web push (needs VAPID keys)
- Self-hosted fonts (needs font binaries)
- CSP **enforce** + HttpOnly cookie sessions (refactor inline handlers first)
- "For you" rail / next-story modal changes (deep UI-engine work — own session)
