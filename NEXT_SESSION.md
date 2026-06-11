# Next Session — Punch List (updated 11 Jun 2026, evening)

Current state: new briefing design live as `index.html`; **Learn AI and Archive now
fully redesigned to the briefing layout**. Deploy set = index.html, education.html,
archive.html + pai-feed-engine.js, pai-google-ui.js, pai-translate.js,
pai-chrome.css, pai-chrome.js, **pai-account.js (NEW — must ship)** +
functions/send-digest.js (restyled email).
Old homepage preserved locally as `index_classic_backup.html`.

## Done this session (push to git to deploy)

1. ✅ Sign-in restored — new `pai-account.js` wires the sheet to the existing /auth
   functions (signup/login/session/logout + getdata/setdata). Account sheet now shows
   🎓 Continue learning + 🕐 Recently read, synced per user. Device-only fallback when
   /auth is unreachable. Loaded on all 3 pages AFTER the other scripts.
2. ✅ Learn AI (education.html) — full briefing redesign (canvas + right rail with
   Subscribe / Your learning / About).
3. ✅ Archive — full briefing redesign (stats + About in the rail, chips for filters).
4. ✅ Lead card: leads with the first story that has an image; image error chain
   proxied thumb → original URL → branded gradient.
5. ✅ Right rail order: Subscribe → Trending → Top sources → Live stats.
6. ✅ About: compact "About PromptAI" panel at the bottom of the right rail on all
   3 pages (condensed from the classic homepage About section).
7. ✅ Homepage section headings: kicker + large serif heading style.
8. ✅ Blogs tab: stories with images promoted into a 2-col image-on-top grid.
9. ✅ Appearance themes: 3 clearly distinct looks (clean white / blue-tinted +
   navy / warm paper + teal) — page bg, cards, borders, shadows all retheme.
10. ✅ Popovers (language/theme/subscribe) now position:fixed — work after scrolling.
11. ✅ Search: dedicated results view across news + papers + blogs + tools; lazy-loads
    missing feeds; mobile magnifier button reveals the search bar; cross-page handoff kept.
12. ✅ Mobile polish: compact topbar (<560px), mobile search, 1-col grids, modal full-screen.
13. ✅ Newsletter (send-digest.js): email restyled to match the light briefing brand
    (white card, serif headlines, blue accents, footer nav row). Deliverability bits
    (List-Unsubscribe, plain-text part, batching) untouched.

## Open items

1. **Verify /auth KV binding `USERS`** is configured in Cloudflare Pages — the new
   account sheet depends on it (falls back to device-only mode if missing).
2. After deploy: send a test digest (`/send-digest?key=…&to=you@…`) to eyeball the
   restyled email in Gmail/Outlook.
3. `emails/*.html` preview files still show the old dark digest design — refresh them
   to match the new light template if they're still used as references.
4. Consider surfacing saved/liked actions (data model already supports them).
