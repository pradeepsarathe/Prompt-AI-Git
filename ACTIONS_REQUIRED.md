# ACTIONS REQUIRED — deploy & manual steps (11 Jun 2026)

Everything in this package is code-complete. The items below are the things
**only you** can do (dashboard settings, pushing, testing with real email).

## 1. Push this package to git → auto-deploys
Copy the contents of `deploy-2026-06-11/` over the repo root of
`pradeepsarathe/Prompt-AI-Git` and push to `main`. Changed/new files:

| File | What changed |
|---|---|
| `functions/auth.js` | Rate limiting + lockout, PBKDF2 600k (auto-upgrades old hashes), password reset, CORS locked to promptai.in, delete-account |
| `functions/subscribe.js` | **Double opt-in** — stores `pending:<email>` + sends confirmation link instead of subscribing immediately |
| `functions/confirm.js` | **NEW** — `/confirm` endpoint: activates the address, sends the first briefing |
| `functions/send-digest.js` | `Authorization: Bearer` auth, skips `pending:`/`meta:` keys, writes `meta:lastRun` health report |
| `_headers` | **NEW** — HSTS, nosniff, X-Frame-Options, Referrer-Policy, Permissions-Policy + noindex on backup pages |
| `_redirects` | feed.xml / sitemap.xml routing + www→apex |
| `privacy.html`, `terms.html` | **NEW** — linked from the new homepage footer |
| `index.html` | h1/h2/h3 hierarchy, "Blogs"→"Deep dives" tab, footer with Privacy/Terms, dialog ARIA, og-image.jpg |
| `education.html`, `archive.html` | og-image.jpg reference only |
| `pai-google-ui.js` | Keyboard-accessible cards (Tab + Enter/Space), URL per section (#news…, Back works), aria-current tabs, modal focus return |
| `pai-account.js` | "Forgot password?" flow + `/?reset=<token>` landing, password minimum now 8 chars (matches backend) |
| `og-image.jpg` | **NEW** — 48 KB (was 552 KB PNG). Keep og-image.png in the repo or delete it; nothing references it anymore |

## 2. Cloudflare Pages settings (one-time)
- **KV binding `USERS`** — required for sign-in, rate limiting and password
  reset. Pages → Settings → Functions → KV namespace bindings.
- Confirm existing bindings/secrets are still set: `SUBSCRIBERS` (KV),
  `RESEND_API_KEY`, `FROM_EMAIL`, `CRON_SECRET`.

## 3. Migrate the cron call to header auth
`/send-digest?key=…` still works, but query strings leak into logs. In
cron-job.org, change the job to:
- URL: `https://promptai.in/send-digest` (no `?key=`)
- Header: `Authorization: Bearer <CRON_SECRET>`

Health check any time: KV key `meta:lastRun` in the SUBSCRIBERS namespace
shows last send time, recipient count, and any Resend error.

## 4. Test with a real inbox (10 minutes)
1. **Double opt-in:** subscribe with a test address → confirmation email →
   click link → `/confirm` page + first briefing arrives.
2. **Password reset:** create an account → sign out → "Forgot password?" →
   email link → lands on `/?reset=…` → set new password → signed in.
3. **Digest:** `curl -H "Authorization: Bearer $CRON_SECRET" "https://promptai.in/send-digest?to=you@example.com"`.

## 5. Resend dashboard
SPF + DKIM + DMARC for `promptai.in` must all show **Verified** — double
opt-in protects sender reputation but can't fix missing DNS records.

## 6. After deploy — verify
- `https://promptai.in/og-image.jpg` loads; share preview works
  ([opengraph.xyz](https://www.opengraph.xyz)).
- Response headers include `Strict-Transport-Security` (the `_headers` file).
- `#news` / `#research` URLs open on the right tab; browser Back walks tabs.
- Tab through the homepage: cards focus and open with Enter.

## Notes
- Existing subscribers are grandfathered as active — double opt-in only
  affects new signups. Unconfirmed signups expire from KV after 7 days.
- Existing user passwords keep working; hashes upgrade to 600k iterations
  silently on next successful login.
- A strict Content-Security-Policy is deliberately **not** set yet (inline
  handlers + third-party feed proxies would break). Future work.
