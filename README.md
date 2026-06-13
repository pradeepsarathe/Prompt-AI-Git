# Deploy — Growth Pack (June 13, 2026)

Copy everything in this folder into the repo root of `pradeepsarathe/Prompt-AI-Git`
(same structure), commit, push. Cloudflare Pages auto-deploys.

## What's inside
- `prompt/` — all 50 prompt pages (25 updated with share buttons + OG meta, 25 brand new)
- `og/` — 51 social-share images (one per prompt page + Hindi hub)
- `prompts-hindi.html` — NEW Hindi prompts hub
- `prompts.html` — 50-count copy + hreflang + Hindi link
- `prompts-data.js` — 50 prompts (was 25)
- `llms.txt` — NEW AI-citation file (served at promptai.in/llms.txt)
- `functions/sitemap.js` — Hindi page added, lastmod bumped
- `functions/weekly-report.js` — NEW weekly traffic email
- `functions/lib/promptslugs.js` — regenerated, 50 entries

## After pushing (2 minutes)
1. Cloudflare Pages → Settings → Environment variables → add
   `REPORT_EMAIL` = your email
2. Cron service → new WEEKLY schedule (Mon 08:00 IST):
   `https://promptai.in/weekly-report?key=YOUR_CRON_SECRET`

## Verify after deploy
- https://promptai.in/prompts.html → shows 50, Hindi link visible
- https://promptai.in/prompts-hindi.html → loads
- https://promptai.in/prompt/pre-mortem → new page works, share row visible
- https://promptai.in/llms.txt → serves the text file
- https://promptai.in/weekly-report?key=CRON_SECRET → sends you the report
- Paste any prompt URL into WhatsApp → branded preview card appears
