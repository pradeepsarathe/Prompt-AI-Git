# Next Session — Punch List (updated 11 Jun 2026, late)

Current state: hardening + a11y/SEO session done. Deploy package =
`deploy-2026-06-11/` (see `ACTIONS_REQUIRED.md` inside it for the full file
list + manual steps). Repo `pradeepsarathe/Prompt-AI-Git@main` does NOT have
these changes yet — push the package.

## Done this session
1. ✅ auth.js — KV rate limiting + login lockout, PBKDF2 600k (transparent
   upgrade of legacy 100k hashes), email password reset, CORS locked down,
   delete-account endpoint. (R11/R12)
2. ✅ Double opt-in: subscribe.js issues a confirmation link; NEW confirm.js
   activates + sends the first briefing. Old subscribers grandfathered. (R18)
3. ✅ send-digest.js — Bearer-header auth (?key= still works), skips
   pending:/meta: keys, writes meta:lastRun health report. (R9/R14)
4. ✅ _headers — HSTS, nosniff, XFO, Referrer-Policy, Permissions-Policy +
   noindex on backup/prototype pages. No CSP yet (inline handlers). (R15)
5. ✅ privacy.html + terms.html, linked from a new homepage footer. (R16)
6. ✅ index.html — real h1/h2/h3 hierarchy, "Blogs" tab → "Deep dives",
   dialog/toast ARIA, aria-current tabs. (R20/R34/R26)
7. ✅ pai-google-ui.js — cards keyboard-accessible (R24), sections get URLs
   #news/#research/… with working Back (R27), modal focus return.
8. ✅ pai-account.js — Forgot password? flow + /?reset=<token> landing;
   password min length 8 to match backend.
9. ✅ og-image.jpg 48 KB (was 552 KB png); all 3 pages re-pointed. (R7)

## Open items (carried / new)
1. **Push `deploy-2026-06-11/` to git**, then walk `ACTIONS_REQUIRED.md`
   (USERS KV binding, cron → Bearer header, Resend DNS, live tests).
2. emails/*.html preview files still show the old dark digest design.
3. R21 (rankable URLs: per-guide pages, issue archive) — biggest SEO lever,
   not started.
4. R25 full focus *trap* in modal/sheet (open/close focus handled; trap not).
5. R35 tools.json with lastReviewed dates (directory is hard-coded, aging).
6. Consider deleting og-image.png + index_classic_backup.html from the repo
   once the deploy is verified (R4/R23).
