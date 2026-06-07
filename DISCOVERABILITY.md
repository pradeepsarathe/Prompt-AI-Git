# PromptAI — Google Discoverability Guide

_Last updated: June 7, 2026_

This is the operational checklist for getting (and keeping) PromptAI indexed and ranking on Google. The on-page/technical SEO is now done in code — this covers what you do **outside** the codebase.

---

## ✅ What was just shipped (in code)

| Change | File(s) | Why |
|---|---|---|
| `robots.txt` (allow all + sitemap pointer) | `robots.txt` *(new)* | Tells crawlers where the sitemap is; blocks infinite `?q=` archive URLs |
| Canonical tags | `index.html`, `archive.html`, `education.html` | Prevents duplicate-URL dilution (www/apex, trailing slash, params) |
| `meta robots` (max-image-preview:large) | all 3 pages | Opts into large image thumbnails in search results |
| Meta description + OG + Twitter cards | `archive.html` (had none), `education.html` (had partial) | Real SERP snippets + link previews |
| `sitemap.xml` `<lastmod>` dates | `sitemap.xml` | Signals freshness to Google |
| Structured data: `WebPage`, `CollectionPage`, `BreadcrumbList`, `ItemList` | all 3 pages | Rich-result eligibility, breadcrumbs in SERP |
| Branded OG image (1200×630) | `og-image.png` *(new)* | Was referenced but missing — previews were blank |

> **Deploy note:** these are the **root** files = the git repo `pradeepsarathe/Prompt-AI-Git`. Commit + push and Cloudflare Pages will pick them up. **Make sure `og-image.png` and `robots.txt` get committed** — confirm `https://promptai.in/robots.txt` and `https://promptai.in/og-image.png` both load after deploy.

---

## 🔑 Step 1 — Google Search Console (do this first)

This is the #1 lever. Without it, you're blind to how Google sees the site.

1. Go to **https://search.google.com/search-console** and sign in.
2. Click **Add property** → choose **Domain** (not URL prefix) → enter `promptai.in`.
3. Google gives you a **TXT DNS record**. Add it at your domain registrar / Cloudflare DNS:
   - Type: `TXT`, Name: `@`, Value: `google-site-verification=...`
4. Wait a few minutes, click **Verify**.
5. Once verified → **Sitemaps** (left menu) → enter `sitemap.xml` → **Submit**.
6. **URL Inspection** (top bar) → paste `https://promptai.in/` → **Request indexing**. Repeat for `/archive.html` and `/education.html`.

## 🔑 Step 2 — Bing Webmaster Tools (5 min, free traffic)

1. **https://www.bing.com/webmasters** → sign in.
2. **Import from Google Search Console** (one click if GSC is done) — or add `promptai.in` and verify.
3. Submit `https://promptai.in/sitemap.xml`.
   > Bing also powers DuckDuckGo, ChatGPT search, and Copilot — worth the 5 minutes.

---

## 🧪 Step 3 — Verify everything works

| Check | Tool |
|---|---|
| Structured data is valid | https://search.google.com/test/rich-results — test all 3 URLs |
| OG image / preview renders | https://www.opengraph.xyz/ — paste each URL |
| Twitter card renders | https://cards-dev.twitter.com/validator |
| Mobile-friendly | GSC → "Mobile Usability" report |
| robots.txt parses | GSC → Settings → robots.txt report, or visit `/robots.txt` |

---

## ⚠️ The one structural risk: client-rendered content

The **live feed, papers, and tools load via JavaScript from third-party RSS** after page load. Googlebot *can* render JS, but it's slower and less reliable than static HTML — and content fetched from external APIs at runtime often **won't get indexed as PromptAI's content**.

**What already works in your favor:** every section has real, static, crawlable copy (`<h1>`, `<h2>`, intros) — so the *pages* index fine. It's the individual feed *items* that won't.

**If you want individual articles/papers to rank** (bigger project, optional):
- Server-render the archive at build time (Cloudflare Pages Function or scheduled build) so each item exists as static HTML, **or**
- Give high-value evergreen content (the education guides) their own real URLs with full static text — these are your best ranking candidates since they're stable and unique.

---

## 📈 Step 4 — Ongoing (monthly, 10 min)

- **GSC → Performance:** which queries bring impressions/clicks → write/expand content around the ones with impressions but low clicks.
- **GSC → Pages:** check "Not indexed" reasons and fix.
- **Keep `sitemap.xml` `<lastmod>` current** when you ship meaningful changes.
- **Internal links:** make sure every page links to the others (nav already does this ✅) and add contextual links from the education guides into the feed/archive.
- **Backlinks** move the needle most: get listed on AI-tool directories, submit the RSS feed to aggregators, and share the OG-card links on X/LinkedIn (now that previews render).

---

## Quick reference — submit-after-every-deploy

```
1. git push                          → Cloudflare auto-deploys
2. Confirm /robots.txt + /og-image.png load
3. GSC → Sitemaps → resubmit if structure changed
4. GSC → URL Inspection → Request indexing for changed pages
```
