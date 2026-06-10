# PromptAI — Code Review & Quality Improvements
_Reviewed against the live repo `pradeepsarathe/Prompt-AI-Git@main` · June 9, 2026_

## ✅ Shipped this session
- **`functions/send-digest.js` → v2 (image-led "Netflix-grade" briefing).**
  - New RSS image extraction (`pickImage`): reads `media:content`, `media:thumbnail`,
    `<enclosure>`, `<itunes:image>`, `<image><url>`, and the first `<img>` in
    `content:encoded`/`description`. Cleans protocol-relative URLs, drops tracking
    pixels/spacers/gravatars.
  - Cinematic hero for the top story + poster-thumbnail cards. Falls back to branded
    gradient posters when a feed has no image — never looks broken.
  - Bonus fix: subscriber list now filters out `rl:<ip>` rate-limit keys so they're
    never emailed (they live in the same KV namespace).
- **`robots.txt`** — clean allow-all (search + AI crawlers). Cloudflare managed-robots
  toggle disabled.

---

## �︎ Recommended next (in priority order)

### 1. Email deliverability — biggest risk to the USP
The newsletter is the product, so inbox placement matters most.
- **SPF, DKIM & DMARC** must be verified for `promptai.in` in Resend's dashboard.
  Without all three, briefings land in spam (or get rejected). Confirm "Verified".
- Add a **plain-text alternative** to every send. Resend accepts a `text:` field
  alongside `html:`. HTML-only mail scores worse with spam filters.
- The hero uses a CSS `background-image`. Apple/iOS/Gmail render it; **Outlook desktop
  shows the gradient fallback** (acceptable). If Outlook is a big slice of your list,
  switch the hero to a real `<img>` with the headline in the block beneath it.

### 2. Stale/duplicated email templates — consolidate
- `emails/weekly-digest.html` is a **decorative mockup that is never sent** (still says
  "Issue #12"). The real template is `digestHtml()` in code. Either delete the static
  file or regenerate it from the new design so it stops misleading.
- `welcomeHtml()` is **inlined inside `subscribe.js`** and also exists as
  `emails/welcome.html` — two copies that can drift. Pick one source of truth.

### 3. Feed resilience
- A few sources are fragile (Verge Atom, Google Research Blogspot, The Batch). Log which
  feeds return 0 items so dead sources surface instead of silently shrinking the digest.
- Consider caching the last good digest in KV so a total feed outage still sends
  *something* rather than the "all feeds failed" no-op.

### 4. SEO / discoverability (the other open thread)
- Verify indexing in **Search Console → URL Inspection**, not `site:` search.
- The feed content is JS-rendered — pre-render or server-inject the latest headlines
  into `index.html` so Googlebot sees real content on first paint (see DISCOVERABILITY.md).

### 5. Housekeeping
- Local folder copies (`promptai-deploy/`, `promptai-latest/`, etc.) drift from git.
  Consider deleting them so the repo is unambiguously the source of truth.

---

## Deploy checklist for this session
1. Commit **`functions/send-digest.js`** (v2) to the repo → push.
2. Test one real send to yourself:
   `https://promptai.in/send-digest?key=YOUR_CRON_SECRET&to=you@example.com`
3. Confirm images load and the hero renders. Check Resend dashboard for SPF/DKIM/DMARC.
4. (Already live) `robots.txt`.
