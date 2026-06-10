# PromptAI — Quality Pass (June 9, 2026)

Reviewed against the live git repo `pradeepsarathe/Prompt-AI-Git@main` (the source of
truth). The codebase is already mature and well-built, so this pass is **surgical**: it
targets concrete deliverability wins, real content inconsistencies, and project hygiene.
Older punch-list items (broken news sources, HN deprioritization, login persistence /
guest→account migration, the global visitor/read counter) were already resolved in the
live code and needed no further work.

---

## Files to commit to the repo (auto-deploys via Cloudflare Pages)

| File | Change |
|---|---|
| `functions/send-digest.js` | Plain-text email alternative + one-click List-Unsubscribe headers |
| `functions/subscribe.js` | Same for the on-signup send; accurate welcome copy + plain-text |
| `emails/welcome.html` | Synced preview copy to match what's actually sent (removed drift) |
| `index.html` | Cadence + "what's inside" + meta-description accuracy; reduced-motion a11y |

Local-only (not committed): deleted the drifting folder copies — see "Cleanup" below.

---

## 1. Email deliverability — the biggest lever (newsletter is the product)

**`functions/send-digest.js`**
- **Plain-text alternative** on every send. Added `digestText()` (exported) and pass a
  `text:` field alongside `html:` in the Resend batch. HTML-only mail is penalised by
  spam filters; a proper multipart message scores better.
- **One-click unsubscribe headers** on every message:
  `List-Unsubscribe: <…>` + `List-Unsubscribe-Post: List-Unsubscribe=One-Click`.
  Gmail & Yahoo now **require** these for bulk senders — this is a direct inbox-placement
  improvement, not cosmetic.

**`functions/subscribe.js`**
- Imports `digestText` and sends a `text:` alternative on the signup confirmation send.
- Added `welcomeText()` for the feeds-empty fallback path.
- Same `List-Unsubscribe` one-click headers on the signup send.
- Tightened the inlined `welcomeHtml()` bullets so they describe what the digest
  **actually** sends (headlines · hand-picked deep dives · one paper) — previously
  promised "3 must-read papers".

## 2. Content consistency (trust)

- **Cadence fixed.** The homepage promised "**Mondays**" but the welcome email, the digest
  footer, and `emails/index.html` all say **Tuesday**. Homepage → **Tuesdays**. (If your
  real send day is Monday, flip these four spots instead — they should match whichever is true.)
- **"What's inside" made accurate.** Homepage chip "🛠 3 new tools" → "📝 Hand-picked deep
  dives" — the briefing sends news + blogs + a paper, not tools.
- **Meta description** no longer cites "MIT Tech Review" (not a current source); now lists
  arXiv, Hacker News, TechCrunch and the top AI labs.
- **`emails/welcome.html`** preview copy re-synced to match the live `welcomeHtml()` so the
  preview shown in `emails/index.html` reflects reality.

## 3. Accessibility polish (`index.html`)

- Extended the `prefers-reduced-motion` block: disables `scroll-behavior: smooth` and the
  looping `pulse` animations (hero badge dot, live dot) for users who opt out of motion.

## 4. Cleanup — drifting local copies removed

Deleted the stale local folder copies that drift from git and caused exactly the confusion
CLAUDE.md warns about (none of these are in the repo):
`promptai-deploy/`, `promptai-latest/`, `promptai-site/`, `promptai-update/`, `changed-files/`.
The repo `pradeepsarathe/Prompt-AI-Git@main` remains the single source of truth.

---

## Recommended next — needs a product decision (not changed blindly)

1. **Email theme mismatch.** The *sent* digest (`digestHtml()`) is **dark**
   (`#0b1020`). `emails/briefing-preview.html` is a **light** mockup, and
   `emails/weekly-digest.html` is an older "Issue #12" mockup that is **never sent**.
   Pick the canonical look (dark vs light), then regenerate the two static previews from
   `digestHtml()` so `emails/index.html` shows what subscribers actually receive. I left the
   live email untouched since the intended theme is a brand call.
2. **SPF / DKIM / DMARC** for `promptai.in` must show **Verified** in Resend — the single
   biggest factor in whether briefings reach the inbox. The List-Unsubscribe headers above
   help, but only alongside verified auth.
3. **Feed resilience** (`functions/send-digest.js`): log feeds that return 0 items so dead
   sources surface, and cache the last good digest in KV so a total feed outage still sends
   something rather than the no-op.
4. **SEO**: the feed is JS-rendered — server-inject the latest headlines into `index.html`
   so Googlebot sees real content on first paint (see DISCOVERABILITY.md).
