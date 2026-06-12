# NEXT SESSION

## State (2026-06-12, evening)
The "Fix Pack" from *PromptAI Platform Review v2* is implemented in this
project's root + `functions/` — push these files to the repo root of
`pradeepsarathe/Prompt-AI-Git`:

  index.html, 404.html, pai-google-ui.js, pai-feed-engine.js, pai-account.js,
  functions/subscribe.js, functions/confirm.js, functions/send-digest.js,
  functions/stats.js, functions/api/summarize.js, functions/api/refresh-feeds.js

See `PromptAI Fix Pack — June 12.html` for the full change list.

## Manual actions after deploy
1. **Cron**: edit the weekly send-digest schedule → append `&freq=weekly`;
   add a NEW daily schedule (e.g. 07:00 IST) with `&freq=daily`.
   (Without `freq`, a run emails everyone — legacy behaviour.)
2. Funnel numbers: `GET /stats?events=YYYY-MM-DD` (modal_open,
   subscribe_submit/success, sample_issue_click, explain_click, search_used).
3. Still manual & still the top priority (review #1/#2): GSC + Bing
   submission, DISCOVERABILITY.md checklist, content cadence.

## Ideas for next time
- Refactor inline event handlers → enable a strict CSP in `_headers`,
  then move sessions to HttpOnly cookies (review #6 second half).
- Web push for the daily summary (SW already shipped; needs VAPID keys).
- D1 migration → full-text archive search (review P2).
- Welcome sequence (3 emails) + dormant win-back.
- Email previews in `emails/` are stale vs the digest template — regenerate.
