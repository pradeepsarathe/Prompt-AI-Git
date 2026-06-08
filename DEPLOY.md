# PromptAI — Deploy Bundle

Drop these into your repo (`pradeepsarathe/Prompt-AI-Git`) at the paths shown, commit, and push. Cloudflare Pages auto-deploys.

## File placement

| File in this bundle | Goes to (repo path) | New/Replace |
|---|---|---|
| `index.html` | `/index.html` | replace |
| `archive.html` | `/archive.html` | replace |
| `education.html` | `/education.html` | replace |
| `sitemap.xml` | `/sitemap.xml` | replace |
| `robots.txt` | `/robots.txt` | **new** |
| `og-image.png` | `/og-image.png` | **new** (binary — make sure it commits) |
| `_redirects` | `/_redirects` | replace |
| `functions/sitemap.js` | `/functions/sitemap.js` | **new** |
| `DISCOVERABILITY.md` | (reference only — optional, not deployed) | — |

## What's included

**SEO / discoverability**
- `robots.txt` (allows crawlers, points to sitemap, blocks `?q=` archive noise)
- Canonical tags on index, archive, education
- Meta description + Open Graph + Twitter cards on archive & education (index already had them)
- Branded `og-image.png` (1200×630) — was referenced but missing
- Expanded JSON-LD (WebPage, CollectionPage, BreadcrumbList, education ItemList)

**Auto-dating sitemap**
- `functions/sitemap.js` stamps fresh `<lastmod>` on `/` and `/archive.html` every request
- `_redirects` routes `/sitemap.xml` → the Function (same pattern as `/feed.xml`)
- Bump `EDU_LASTMOD` in `functions/sitemap.js` only when education.html changes

**Homepage stats (index.html)**
- Hero now shows **Total visitors** (all-time cumulative, KV `v:total` — not per session/browser/day) and **Total reads** (all-time global, KV `a:total`)
- Both public (logged in or not)
- Tool-directory clicks now also count as reads

**News cards (index.html)**
- Imageless cards (most sources) are now compact text cards — no fake gradient blocks (~373px → ~200px)
- Real thumbnails routed through image proxy (fixes hotlink/referrer/mixed-content failures); dead images collapse cleanly
- Title clamped to 2 lines; fixed "OPENAI BLOG" badge wrapping
- Hero "Trending" image also proxied

**AI Education pathway cards (education.html)**
- Redesigned as numbered "pathway" steppers: level badges (Beginner/Intermediate/Advanced), time/steps meta, connected numbered timeline, per-level accent colors, and a Start CTA

## Reminder
- Requires the `STATS` KV namespace binding in Cloudflare Pages (Settings → Functions → KV bindings) for the visitor/read counters — already appears bound on prod.
- After deploy, confirm `/robots.txt`, `/og-image.png`, and `/sitemap.xml` all load.
