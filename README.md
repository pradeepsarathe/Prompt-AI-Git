# Edit #4 — Research feed fix (arXiv parser + CSP connect-src) — 2026-06-13

Push the contents of this folder to the repo root. Front-end + headers only.

## Symptom
News tab populated, **Research tab empty** ("Nothing here yet"). The page/JS
were fine — arXiv just returned 0 papers to the client.

## Root cause (not the recent UI/email/footer pushes)
The Research feed pulls from **arXiv**. The client-side fallback parser in
`pai-feed-engine.js` (`legacyFetchPapers`) only read RSS `<item>` elements — if
arXiv serves **Atom `<entry>`** (or the server payload had 0 papers and the
client had to parse the feed itself), it found nothing → empty tab. News uses
different sources (HN + rss2json) so it kept working.

The server aggregator's parser (`feedlib.js parseFeed`) already handled both
`<item>` and `<entry>`, so this was a client-fallback-only gap.

## Fixes
1. **`pai-feed-engine.js`** — `legacyFetchPapers` now parses **both** RSS
   `<item>` and Atom `<entry>` (title, link via text *or* `href` *or* `<id>`,
   summary/content for description, `category term`, `author > name`,
   published/updated dates). A single arXiv format change can no longer empty
   the Research tab. The 4-way proxy race (`/rss-proxy`, `export.arxiv.org`,
   allorigins, corsproxy) is unchanged — now any one succeeding renders papers.
2. **`_headers`** — added the arXiv + proxy hosts to the CSP `connect-src`
   (`rss.arxiv.org`, `export.arxiv.org`, `api.allorigins.win`, `corsproxy.io`).
   The CSP is still **Report-Only** (doesn't block today), but this keeps the
   policy accurate and prevents Research from breaking if/when you switch the
   CSP to enforce.

## Verify after deploy
- Open the **Research** tab → arXiv papers list within a few seconds.
- If still empty, check `/metrics?key=CRON_SECRET` for the aggregator's
  `papers` count and `/api/feeds` JSON — a 0 there means the Worker itself
  can't reach arXiv (rate-limit/IP), which the client fallback now covers.

## Not changed
No subscribe/footer/email/summary code touched. Research render code
(`pai-google-ui.js`) untouched — it was already correct.
