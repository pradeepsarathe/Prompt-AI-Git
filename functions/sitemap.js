// functions/sitemap.js
// Cloudflare Pages Function — dynamic sitemap for PromptAI
// Accessible at: /sitemap and /sitemap.xml (via _redirects)
//
// Now enumerates the rankable URLs too (R21): /issues, every
// /issue/<date> snapshot in KV, the /topic/* hubs and /prompts.html.

import { PROMPT_PAGES } from './lib/promptslugs.js';
import { LEARN_PATHS } from './lib/learnpaths.js';

const EDU_LASTMOD = '2026-06-13';   // ← update when education.html changes
const LEGAL_LASTMOD = '2026-06-11'; // privacy.html / terms.html
const PROMPTS_LASTMOD = '2026-06-13'; // ← update when prompts.html changes
const GLOSSARY_LASTMOD = '2026-06-13'; // ← update when glossary pages change

const TOPICS = ['llms', 'agents', 'vision', 'robotics', 'policy', 'research', 'tools'];

// Evergreen glossary term pages (/glossary/<slug>) — high-value, stable,
// keyword-rich SEO landing pages. Keep in sync with the glossary/ folder.
const GLOSSARY_SLUGS = [
  'agi', 'ai-agent', 'chain-of-thought', 'context-window', 'embedding',
  'fine-tuning', 'hallucination', 'inference', 'llm', 'multimodal',
  'parameters', 'prompt-engineering', 'rag', 'temperature', 'token', 'transformer',
];

export async function onRequest(context) {
  const { env } = context;
  const today = new Date().toISOString().slice(0, 10);

  const urls = [
    { loc: 'https://promptai.in/',               lastmod: today,           changefreq: 'hourly',  priority: '1.0' },
    { loc: 'https://promptai.in/issues',         lastmod: today,           changefreq: 'daily',   priority: '0.9' },
    { loc: 'https://promptai.in/prompts.html',   lastmod: PROMPTS_LASTMOD, changefreq: 'weekly',  priority: '0.8' },
    { loc: 'https://promptai.in/prompts-hindi.html', lastmod: PROMPTS_LASTMOD, changefreq: 'weekly', priority: '0.7' },
    { loc: 'https://promptai.in/archive.html',   lastmod: today,           changefreq: 'daily',   priority: '0.8' },
    { loc: 'https://promptai.in/education.html', lastmod: EDU_LASTMOD,     changefreq: 'weekly',  priority: '0.7' },
    { loc: 'https://promptai.in/learn',          lastmod: EDU_LASTMOD,     changefreq: 'weekly',  priority: '0.7' },
    { loc: 'https://promptai.in/glossary.html',  lastmod: GLOSSARY_LASTMOD, changefreq: 'monthly', priority: '0.7' },
    { loc: 'https://promptai.in/privacy.html',   lastmod: LEGAL_LASTMOD,   changefreq: 'yearly',  priority: '0.2' },
    { loc: 'https://promptai.in/terms.html',     lastmod: LEGAL_LASTMOD,   changefreq: 'yearly',  priority: '0.2' },
  ];

  // Per-term glossary pages (/glossary/<slug>) — generated from the list above
  GLOSSARY_SLUGS.forEach(slug => urls.push({
    loc: 'https://promptai.in/glossary/' + slug, lastmod: GLOSSARY_LASTMOD, changefreq: 'monthly', priority: '0.6',
  }));

  TOPICS.forEach(t => urls.push({
    loc: 'https://promptai.in/topic/' + t, lastmod: today, changefreq: 'daily', priority: '0.7',
  }));

  // Per-path Learn AI pages (/learn/<slug>) — generated from learnpaths.js
  LEARN_PATHS.forEach(p => urls.push({
    loc: 'https://promptai.in/learn/' + p.slug, lastmod: EDU_LASTMOD, changefreq: 'monthly', priority: '0.7',
  }));

  // Per-prompt pages (R21/issue #1) — generated from prompts-data.js
  PROMPT_PAGES.forEach(p => urls.push({
    loc: 'https://promptai.in/prompt/' + p.slug, lastmod: PROMPTS_LASTMOD, changefreq: 'monthly', priority: '0.7',
  }));

  // Issue pages from KV (cap at the 180 newest to keep the sitemap lean).
  if (env.STATS) {
    try {
      let days = [], cursor;
      do {
        const page = await env.STATS.list({ prefix: 'issue:', cursor, limit: 1000 });
        days.push(...page.keys.map(k => k.name.slice(6)));
        cursor = page.list_complete ? null : page.cursor;
      } while (cursor);
      days.filter(d => /^\d{4}-\d{2}-\d{2}$/.test(d)).sort().reverse().slice(0, 180)
        .forEach(d => urls.push({
          loc: 'https://promptai.in/issue/' + d, lastmod: d, changefreq: 'never', priority: '0.6',
        }));
    } catch (e) { /* sitemap still valid without issues */ }
  }

  const xml = `<?xml version="1.0" encoding="UTF-8"?>
<urlset xmlns="http://www.sitemaps.org/schemas/sitemap/0.9">
${urls.map(u => `  <url>
    <loc>${u.loc}</loc>
    <lastmod>${u.lastmod}</lastmod>
    <changefreq>${u.changefreq}</changefreq>
    <priority>${u.priority}</priority>
  </url>`).join('\n')}
</urlset>`;

  return new Response(xml, {
    status: 200,
    headers: {
      'Content-Type': 'application/xml; charset=utf-8',
      'Cache-Control': 'public, max-age=3600',
    },
  });
}
