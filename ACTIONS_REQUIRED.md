# ACTIONS REQUIRED — manual steps to finish this deploy

Everything in this folder is code-complete, but a few things only YOU can do
(dashboard settings, secrets, cron). Work top-to-bottom; ~20 minutes total.

## 1. Cloudflare Pages — bindings (Settings → Functions)

| Binding | Type | Notes |
|---|---|---|
| `STATS` | KV namespace | already exists — feed cache, archive, issues, AI explainer cache all live here |
| `SUBSCRIBERS` | KV namespace | already exists (newsletter) |
| `USERS` | KV namespace | already exists (accounts) |
| `AI` | **Workers AI** | **NEW — required for R30.** Settings → Functions → Workers AI bindings → add, name it exactly `AI`. Free tier (~10k neurons/day) is plenty: one summary per refresh + cached paper explainers. Without it the site still works — summary/explainers just don't render. |

## 2. Environment variables (Settings → Environment variables, Production)

| Var | Value | Why |
|---|---|---|
| `CRON_SECRET` | (already set) | also authorizes `/api/refresh-feeds` + `/health` detail view |
| `UNSUB_SECRET` | any long random string (`openssl rand -hex 32`) | signs unsubscribe links (R17). Optional — falls back to `CRON_SECRET` if unset. |
| `SPONSOR_HTML` | leave **unset** | when you land a sponsor, set it to their HTML snippet and it appears in the email digest (R42). The website slot is in `index.html` → `#sponsor-panel` (remove `hidden`). |

## 3. Cron — add ONE new job (cron-job.org)

Keep the existing Tuesday send-digest job. Add:

- **URL:** `https://promptai.in/api/refresh-feeds`
- **Schedule:** every 30 minutes
- **Header:** `Authorization: Bearer <CRON_SECRET>`

This builds the feed cache, the AI "Today in 60 seconds", the daily
`/issue/<date>` pages and the archive. The site self-heals if a run is
missed, but fresh content depends on this job.

## 4. Uptime monitoring (R41) — 2 minutes

Point UptimeRobot (free) at `https://promptai.in/health` (keyword: `"ok":true`).
Returns 503 when the feed cache is >3h stale — i.e. your cron died.
For a full ops report: `https://promptai.in/health?key=<CRON_SECRET>`.

## 5. Web analytics (R40) — 2 minutes

Cloudflare dash → Analytics & Logs → Web Analytics → add `promptai.in` →
copy the token → in `index.html`, find the commented beacon `<script>` near
the bottom, paste the token, remove the comment wrapper.

## 6. Delete dead artifacts from the REPO (R4/R23)

These confuse crawlers and future sessions. In the repo root, delete:

- `index_classic_backup.html`, `promptai_google.html` (old prototypes — currently only noindexed)
- any local drift folders if they were ever committed: `promptai-deploy/`, `promptai-latest/`, `promptai-site/`, `promptai-update/`
- after confirming deploy: remove the `X-Robots-Tag` blocks for the deleted files from `_headers`

## 7. After first deploy — smoke test

1. `https://promptai.in/api/feeds` → JSON with `news[]`, `papers[]`
2. Trigger the cron once manually → `https://promptai.in/issue/<today>` renders
3. `https://promptai.in/issues`, `/topic/llms`, `/prompts.html` render
4. View-source on `/` → server-rendered headlines inside `<!--SSR:HOME-->` block (R19)
5. `/health` → `"ok":true`
6. Subscribe with a test email → confirm → check unsubscribe link has `&sig=`

## Notes

- **PPTX/PWA:** first visit after deploy installs a service worker (`sw.js`).
  If you ever see stale content during testing: DevTools → Application →
  Service workers → Unregister, then hard reload.
- **Affiliates (R43):** tool links now carry `?ref=promptai`. To use a real
  affiliate URL for a tool, add `"aff": "https://…"` to that tool in `tools.json`.
- **Issue pages backfill:** issues exist from the first cron run onward; there's
  no historical backfill.
