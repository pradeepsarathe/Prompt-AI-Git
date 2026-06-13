// functions/learn/index.js
// GET /learn — hub page linking the per-path Learn AI pages. Crawlable
// CollectionPage that funnels into /learn/<slug> and the fuller education.html.

import { pageShell, htmlResponse } from '../lib/page.js';
import { esc } from '../lib/feedlib.js';
import { LEARN_PATHS } from '../lib/learnpaths.js';

export async function onRequest() {
  const canonical = 'https://promptai.in/learn';
  const title = 'Learn AI — free learning paths';
  const description = 'Three curated, free learning paths in AI: use AI productively, build AI applications, or research AI systems. Step-by-step, beginner to advanced.';

  const cards = LEARN_PATHS.map((p) => `
    <article class="story">
      <div class="src">${esc(p.level)} · ${esc(p.time)} · ${esc(p.steps)} steps</div>
      <h3><a href="/learn/${p.slug}">${esc(p.title)}</a></h3>
      <p>${esc(p.tagline)} ${esc(p.audience)}</p>
      <p style="margin-top:4px"><a href="/learn/${p.slug}">Start this path →</a></p>
    </article>`).join('');

  const body = `
    <h1>Learn AI</h1>
    <p class="lede">Pick a direction. Each path is a free, curated sequence — no fluff, no paywall — that takes you from where you are to genuinely capable.</p>
    <h2>Choose your path</h2>
    <div class="h2-sub">${LEARN_PATHS.length} paths · beginner to advanced</div>
    ${cards}
    <div class="topics" style="margin-top:24px">
      <a href="/education.html">All courses &amp; guides</a>
      <a href="/prompts.html">Prompt library</a>
      <a href="/issues">Past briefings</a>
    </div>`;

  const html = pageShell({
    title, description, canonical,
    breadcrumbs: [{ label: 'Home', href: '/' }, { label: 'Learn AI' }],
    jsonLd: {
      '@context': 'https://schema.org',
      '@type': 'CollectionPage',
      name: title, url: canonical, description,
      hasPart: LEARN_PATHS.map((p) => ({
        '@type': 'Course', name: p.title, url: `https://promptai.in/learn/${p.slug}`,
        description: p.tagline,
        provider: { '@type': 'Organization', name: 'PromptAI', url: 'https://promptai.in/' },
      })),
    },
    body,
  });
  return htmlResponse(html, 86400);
}
