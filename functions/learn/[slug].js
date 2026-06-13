// functions/learn/[slug].js
// GET /learn/<slug> — server-rendered per-path Learn AI page (review: split
// the single education.html "Learning paths" block into stable, unique,
// rankable URLs). Real HTML, canonical, Course + HowTo + BreadcrumbList JSON-LD.

import { pageShell, htmlResponse, notFound } from '../lib/page.js';
import { esc } from '../lib/feedlib.js';
import { findPath } from '../lib/learnpaths.js';

export async function onRequest(context) {
  const { params } = context;
  const slug = String(params.slug || '').trim().toLowerCase();
  const found = findPath(slug);
  if (!found) return notFound('That learning path doesn\u2019t exist. See all paths at /learn.');
  const { path: p, prev, next } = found;

  const canonical = `https://promptai.in/learn/${p.slug}`;
  const title = `${p.title} — AI learning path`;
  const description = `${p.level} AI learning path: ${p.tagline} A free, curated ${p.steps}-step sequence (~${p.time}).`.slice(0, 158);

  const steps = p.plan.map((s, i) => `
    <article class="story">
      <div class="src">Step ${i + 1}</div>
      <h3 style="font-weight:600">${esc(s.t)}</h3>
      <p>${esc(s.d)}</p>
      <p style="margin-top:4px"><a href="${esc(s.url)}" rel="noopener" target="_blank">${esc(s.label)} →</a></p>
    </article>`).join('');

  const sib = (label, q) => q ? `<a href="/learn/${q.slug}">${label}: ${esc(q.title)} →</a>` : '';
  const pager = (prev || next) ? `
    <p style="margin-top:30px;display:flex;justify-content:space-between;gap:16px;flex-wrap:wrap;font-size:.85rem">
      <span>${prev ? `<a href="/learn/${prev.slug}">← ${esc(prev.title)}</a>` : ''}</span>
      <span>${next ? `<a href="/learn/${next.slug}">${esc(next.title)} →</a>` : ''}</span>
    </p>` : '';

  const body = `
    <p class="src" style="font-size:.76rem;color:var(--text-3);font-weight:600;text-transform:uppercase;letter-spacing:.06em">${esc(p.level)} · Learning path</p>
    <h1>${esc(p.title)}</h1>
    <p class="lede">${esc(p.tagline)}</p>
    <section class="summary">
      <div class="k">At a glance</div>
      <ul>
        <li><strong>Who it\u2019s for:</strong> ${esc(p.audience)}</li>
        <li><strong>You\u2019ll be able to:</strong> ${esc(p.outcome)}</li>
        <li><strong>Time:</strong> ${esc(p.time)} &nbsp;·&nbsp; <strong>Steps:</strong> ${esc(p.steps)} &nbsp;·&nbsp; <strong>${esc(p.extra.label)}:</strong> ${esc(p.extra.value)}</li>
      </ul>
    </section>
    <p style="font-size:.96rem;color:var(--text-2);margin:18px 0 6px">${esc(p.intro)}</p>
    <h2>The path</h2>
    <div class="h2-sub">${p.steps} steps · all resources free to start</div>
    ${steps}
    <div class="topics" style="margin-top:24px">
      <a href="/learn">All learning paths</a>
      <a href="/education.html">Courses &amp; guides</a>
      <a href="/prompts.html">Prompt library</a>
    </div>
    ${pager}`;

  const html = pageShell({
    title, description, canonical,
    breadcrumbs: [{ label: 'Home', href: '/' }, { label: 'Learn AI', href: '/learn' }, { label: p.title }],
    jsonLd: {
      '@context': 'https://schema.org',
      '@graph': [
        {
          '@type': 'Course', name: p.title, description, url: canonical,
          provider: { '@type': 'Organization', name: 'PromptAI', url: 'https://promptai.in/' },
          educationalLevel: p.level, isAccessibleForFree: true,
          hasCourseInstance: { '@type': 'CourseInstance', courseMode: 'online', courseWorkload: p.time },
        },
        {
          '@type': 'HowTo', name: `How to ${p.title.toLowerCase()}`, description: p.intro,
          totalTime: p.time && p.time.includes('20') ? 'PT20H' : (p.time.includes('60') ? 'PT60H' : 'PT120H'),
          step: p.plan.map((s, i) => ({ '@type': 'HowToStep', position: i + 1, name: s.t, text: s.d, url: s.url })),
        },
      ],
    },
    body,
  });
  return htmlResponse(html, 86400);
}
