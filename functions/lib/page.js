// functions/lib/page.js
// Shared shell for server-rendered pages (/issue/…, /issues, /topic/…).
// Lightweight, self-contained styling that mirrors the briefing's look —
// these pages are SEO landing pages first, so no JS is required to read
// them. (No onRequest — not a route.)

import { esc } from './feedlib.js';

export function pageShell({ title, description, canonical, body, breadcrumbs, jsonLd }) {
  const crumbs = (breadcrumbs || []).map((c, i) =>
    c.href ? `<a href="${esc(c.href)}">${esc(c.label)}</a>` : `<span aria-current="page">${esc(c.label)}</span>`
  ).join('<span class="sep">›</span>');

  return `<!DOCTYPE html>
<html lang="en">
<head>
<meta charset="UTF-8"/>
<meta name="viewport" content="width=device-width, initial-scale=1.0"/>
<title>${esc(title)} — PromptAI</title>
<meta name="description" content="${esc(description)}"/>
<link rel="canonical" href="${esc(canonical)}"/>
<meta property="og:type" content="article"/>
<meta property="og:url" content="${esc(canonical)}"/>
<meta property="og:site_name" content="PromptAI"/>
<meta property="og:title" content="${esc(title)} — PromptAI"/>
<meta property="og:description" content="${esc(description)}"/>
<meta property="og:image" content="https://promptai.in/og-image.jpg"/>
<meta name="twitter:card" content="summary_large_image"/>
<link rel="alternate" type="application/rss+xml" title="PromptAI — AI Research Feed" href="/feed.xml"/>
${jsonLd ? `<script type="application/ld+json">${JSON.stringify(jsonLd)}</script>` : ''}
<link rel="preconnect" href="https://fonts.googleapis.com"/>
<link rel="preconnect" href="https://fonts.gstatic.com" crossorigin/>
<link href="https://fonts.googleapis.com/css2?family=Roboto:wght@400;500;700&family=Roboto+Serif:opsz,wght@8..144,400;8..144,500;8..144,600&display=swap" rel="stylesheet"/>
<style>
  :root{--accent:#1a73e8;--accent-2:#1967d2;--accent-subtle:#e8f0fe;--bg:#ffffff;--bg-subtle:#f1f3f4;
    --text:#202124;--text-2:#5f6368;--text-3:#80868b;--border-soft:#e8eaed;--card:#ffffff;
    --serif:'Roboto Serif',Georgia,serif;}
  @media (prefers-color-scheme:dark){:root{--accent:#8ab4f8;--accent-2:#aecbfa;--accent-subtle:#1f3658;
    --bg:#17181c;--bg-subtle:#222327;--text:#e8eaed;--text-2:#9aa0a6;--text-3:#7d818a;
    --border-soft:#2d2f33;--card:#1e1f24;}}
  *{margin:0;padding:0;box-sizing:border-box}
  body{font-family:'Roboto',system-ui,sans-serif;background:var(--bg);color:var(--text);line-height:1.6;-webkit-font-smoothing:antialiased}
  a{color:var(--accent);text-decoration:none}
  a:hover{text-decoration:underline}
  .top{position:sticky;top:0;background:var(--bg);border-bottom:1px solid var(--border-soft);padding:14px 20px;display:flex;align-items:center;gap:18px;z-index:10}
  .brand{font-family:var(--serif);font-size:1.3rem;font-weight:600;color:var(--text);display:flex;align-items:center;gap:8px}
  .brand b{color:var(--accent);font-weight:600}
  .brand .dot{width:10px;height:10px;border-radius:50%;background:var(--accent)}
  .top nav{display:flex;gap:16px;font-size:.9rem;margin-left:auto}
  .top nav a{color:var(--text-2)}
  main{max-width:720px;margin:0 auto;padding:34px 20px 80px}
  .crumbs{font-size:.8rem;color:var(--text-3);display:flex;gap:8px;flex-wrap:wrap;margin-bottom:18px}
  .crumbs .sep{color:var(--text-3)}
  h1{font-family:var(--serif);font-size:2rem;line-height:1.2;font-weight:600;letter-spacing:-.4px;margin-bottom:8px}
  .lede{font-size:1rem;color:var(--text-2);margin-bottom:28px}
  h2{font-family:var(--serif);font-size:1.25rem;font-weight:600;margin:34px 0 6px;padding-top:22px;border-top:1px solid var(--border-soft)}
  .h2-sub{font-size:.82rem;color:var(--text-3);margin-bottom:14px}
  .story{padding:14px 0;border-bottom:1px solid var(--border-soft)}
  .story:last-child{border-bottom:none}
  .story .src{font-size:.76rem;color:var(--text-3);font-weight:500;text-transform:uppercase;letter-spacing:.06em}
  .story h3{font-family:var(--serif);font-size:1.05rem;line-height:1.35;font-weight:500;margin:3px 0 4px}
  .story h3 a{color:var(--text)}
  .story p{font-size:.88rem;color:var(--text-2)}
  .summary{background:var(--accent-subtle);border-radius:14px;padding:20px 22px;margin:0 0 10px}
  .summary .k{font-size:.72rem;font-weight:700;letter-spacing:.12em;text-transform:uppercase;color:var(--accent);margin-bottom:10px}
  .summary ul{list-style:none}
  .summary li{font-size:.95rem;line-height:1.55;padding:5px 0 5px 20px;position:relative}
  .summary li::before{content:'•';position:absolute;left:4px;color:var(--accent);font-weight:700}
  .summary .ai-note{font-size:.7rem;color:var(--text-3);margin-top:8px}
  .cta{background:var(--card);border:1px solid var(--border-soft);border-radius:14px;padding:22px;margin-top:40px;text-align:center}
  .cta h4{font-family:var(--serif);font-size:1.15rem;margin-bottom:6px}
  .cta p{font-size:.86rem;color:var(--text-2);margin-bottom:14px}
  .cta a.btn{display:inline-block;background:var(--accent);color:#fff;padding:11px 26px;border-radius:10px;font-weight:600;font-size:.9rem}
  .cta a.btn:hover{text-decoration:none;background:var(--accent-2)}
  .issue-list{list-style:none}
  .issue-list li{padding:13px 0;border-bottom:1px solid var(--border-soft);display:flex;align-items:baseline;gap:14px;flex-wrap:wrap}
  .issue-list .d{font-size:.8rem;color:var(--text-3);flex:none;width:110px}
  .issue-list a{font-family:var(--serif);font-size:1rem;color:var(--text);font-weight:500}
  .topics{display:flex;gap:8px;flex-wrap:wrap;margin:18px 0 4px}
  .topics a{font-size:.8rem;border:1px solid var(--border-soft);border-radius:16px;padding:5px 14px;color:var(--text-2)}
  .topics a:hover{background:var(--accent-subtle);color:var(--accent);text-decoration:none}
  footer{border-top:1px solid var(--border-soft);padding:24px 20px;font-size:.78rem;color:var(--text-3);display:flex;gap:18px;flex-wrap:wrap;max-width:720px;margin:0 auto}
  footer a{color:var(--text-2)}
</style>
</head>
<body>
<header class="top">
  <a class="brand" href="/"><span class="dot"></span>Prompt<b>AI</b></a>
  <nav>
    <a href="/#news">News</a>
    <a href="/#research">Research</a>
    <a href="/issues">Issues</a>
    <a href="/prompts.html">Prompts</a>
    <a href="/education.html">Learn AI</a>
  </nav>
</header>
<main>
  ${crumbs ? `<nav class="crumbs" aria-label="Breadcrumb">${crumbs}</nav>` : ''}
  ${body}
  <div class="cta">
    <h4>Get the briefing</h4>
    <p>The one story that matters, 5 headlines and the paper everyone's citing — every Tuesday, free.</p>
    <a class="btn" href="/#newsletter">Subscribe free</a>
  </div>
</main>
<footer>
  <span>© 2026 PromptAI · promptai.in</span>
  <a href="/privacy.html">Privacy</a>
  <a href="/terms.html">Terms</a>
  <a href="/archive.html">Archive</a>
  <a href="/feed.xml">RSS</a>
</footer>
<script src="/pai-metrics.js" defer></script>
</body>
</html>`;
}

export function storyRow(s) {
  return `<article class="story">
    <div class="src">${esc(s.src || '')}${s.topic ? ' · ' + esc(s.topic) : ''}</div>
    <h3><a href="${esc(s.url)}" rel="noopener">${esc(s.title)}</a></h3>
    ${s.desc ? `<p>${esc(s.desc)}</p>` : ''}
  </article>`;
}

export function htmlResponse(html, cacheSeconds) {
  return new Response(html, {
    status: 200,
    headers: {
      'Content-Type': 'text/html; charset=utf-8',
      'Cache-Control': `public, max-age=${cacheSeconds || 900}`,
    },
  });
}

export function notFound(msg) {
  return new Response(pageShell({
    title: 'Not found',
    description: 'Page not found.',
    canonical: 'https://promptai.in/',
    breadcrumbs: [{ label: 'Home', href: '/' }, { label: 'Not found' }],
    body: `<h1>Not found</h1><p class="lede">${esc(msg || "This page doesn't exist (yet).")} <a href="/">Back to the briefing →</a></p>`,
  }), { status: 404, headers: { 'Content-Type': 'text/html; charset=utf-8', 'Cache-Control': 'no-store' } });
}
