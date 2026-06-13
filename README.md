# Edit #2 — Single sender: hello@promptai.in everywhere (2026-06-13)

All outbound mail comes from **hello@promptai.in** only. Updated every reference
so subscribers have exactly ONE address to whitelist, matching the sender.

Push the contents of this folder to the repo root (paths mirror the repo).

## Changed files
| Path | Change |
|---|---|
| `functions/lib/welcomelib.js` | Welcome email "Never miss it" copy (HTML + plaintext) now says whitelist **hello@promptai.in** (was briefing@). **This is the subscriber-facing one.** |
| `emails/welcome-1.html` | Preview email — same copy change. |
| `emails/index.html` | Setup doc — sender example weekly@ → hello@. |
| `functions/send-digest.js` | `FROM_EMAIL` example comment → hello@ (comment only, no logic change). |
| `functions/weekly-report.js` | `FROM_EMAIL` example comment → hello@ (comment only). |

## The one manual step (Cloudflare, no code)
Set the env var so the actual sender matches the copy:
**Cloudflare Pages → Settings → Variables → `FROM_EMAIL` = `PromptAI <hello@promptai.in>`**

## Why this is safe / complete
- Every subscriber-facing send (digest, welcome 1/2/3, win-back, subscribe
  confirm, password reset) already uses the single `FROM_EMAIL` variable —
  verified in code. So one address = one whitelist.
- `hello@`, `privacy@`, `weekly@`, `briefing@` all still RECEIVE (your Cloudflare
  Email Routing rules forward them to Gmail) — those are inbound-only and need
  no whitelisting.
