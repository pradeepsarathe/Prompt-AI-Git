// functions/issue/[date].js
// ═══════════════════════════════════════════════════════════════════
// GET /issue/2026-06-11 — server-rendered daily briefing issue (R21/R39).
//
// Issues are snapshotted to KV (issue:<YYYY-MM-DD>) by /api/refresh-feeds
// and by send-digest on send day. Fully crawlable: real HTML, canonical
// URL, NewsArticle-ish structured data — these are the rankable pages
// Googlebot never got from the JS-rendered homepage.
// /issue/latest redirects to the newest issue.
// ═══════════════════════════════════════════════════════════════════

import { pageShell, storyRow, htmlResponse, notFound } from '../lib/page.js';
import { esc } from '../lib/feedlib.js';

function prettyDate(d) {
  try {
    return new Date(d + 'T12:00:00Z').toLocaleDateString('en-US', { weekday: 'long', year: 'numeric', month: 'long', day: 'numeric', timeZone: 'UTC' });
  } catch (e) { return d; }
}

export async function onRequest(context) {
  const { params, env, request } = context;
  if (!env.STATS) return notFound('Issue archive is not available right now.');

  let date = String(params.date || '').trim();

  // /issue/latest → 302 to the newest snapshot
  if (date === 'latest') {
    const list = await env.STATS.list({ prefix: 'issue:' });
    const days = list.keys.map(k => k.name.slice(6)).sort().reverse();
    if (!days.length) return notFound('No issues have been published yet.');
    return Response.redirect(new URL('/issue/' + days[0], request.url).toString(), 302);
  }

  if (!/^\d{4}-\d{2}-\d{2}$/.test(date)) return notFound('Issues live at /issue/YYYY-MM-DD.');

  let issue = null;
  try { issue = JSON.parse(await env.STATS.get('issue:' + date) || 'null'); } catch (e) {}
  if (!issue) return notFound(`No issue was published on ${esc(date)}. Browse all issues at /issues.`);

  const nice = prettyDate(date);
  const title = `AI Briefing — ${nice}`;
  const topTitles = (issue.news || []).slice(0, 3).map(s => s.title).join('; ');
  const description = `The PromptAI briefing for ${nice}: ${topTitles}`.slice(0, 158);

  const summaryBlock = issue.summary && issue.summary.bullets && issue.summary.bullets.length ? `
    <section class="summary">
      <div class="k">Today in 60 seconds</div>
      <ul>${issue.summary.bullets.map(b => `<li>${esc(b)}</li>`).join('')}</ul>
      <div class="ai-note">AI-generated from today's headlines — links below for the full stories.</div>
    </section>` : '';

  const body = `
    <h1>${esc(title)}</h1>
    <p class="lede">What mattered in AI on ${esc(nice)} — curated from ${5 + (issue.news || []).length}+ sources.</p>
    ${summaryBlock}
    <h2>Top stories</h2>
    <div class="h2-sub">${(issue.news || []).length} stories</div>
    ${(issue.news || []).map(storyRow).join('')}
    ${(issue.blogs || []).length ? `<h2>Deep dives worth reading</h2>${issue.blogs.map(storyRow).join('')}` : ''}
    ${issue.paper ? `<h2>Research paper of the day</h2>${storyRow(issue.paper)}` : ''}
    <p style="margin-top:30px;font-size:.85rem;color:var(--text-3)">
      <a href="/issues">← All issues</a> &nbsp;·&nbsp; Forwarded this? <a href="/#newsletter">Get your own copy</a>.
    </p>`;

  const html = pageShell({
    title,
    description,
    canonical: `https://promptai.in/issue/${date}`,
    breadcrumbs: [{ label: 'Home', href: '/' }, { label: 'Issues', href: '/issues' }, { label: nice }],
    jsonLd: {
      '@context': 'https://schema.org',
      '@type': 'Article',
      headline: title,
      datePublished: date,
      url: `https://promptai.in/issue/${date}`,
      publisher: { '@type': 'Organization', name: 'PromptAI', url: 'https://promptai.in/' },
      description,
    },
    body,
  });
  return htmlResponse(html, 3600);
}
