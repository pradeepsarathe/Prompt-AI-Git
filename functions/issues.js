// functions/issues.js
// GET /issues — crawlable index of every published briefing issue (R21).
// Linked from subscribe forms as the "read a sample issue" target (R32).

import { pageShell, htmlResponse } from './lib/page.js';

function prettyDate(d) {
  try {
    return new Date(d + 'T12:00:00Z').toLocaleDateString('en-US', { year: 'numeric', month: 'long', day: 'numeric', timeZone: 'UTC' });
  } catch (e) { return d; }
}

export async function onRequest(context) {
  const { env } = context;
  let days = [];
  if (env.STATS) {
    try {
      let cursor;
      do {
        const page = await env.STATS.list({ prefix: 'issue:', cursor, limit: 1000 });
        days.push(...page.keys.map(k => k.name.slice(6)));
        cursor = page.list_complete ? null : page.cursor;
      } while (cursor);
    } catch (e) {}
  }
  days = days.filter(d => /^\d{4}-\d{2}-\d{2}$/.test(d)).sort().reverse();

  const body = `
    <h1>Briefing issues</h1>
    <p class="lede">Every PromptAI daily briefing, archived. The same thing subscribers get by email — the one story that matters, the headlines, and the paper everyone's citing.</p>
    <div class="topics">
      ${['LLMs', 'Agents', 'Vision', 'Robotics', 'Policy', 'Research', 'Tools'].map(t => `<a href="/topic/${t.toLowerCase()}">${t}</a>`).join('')}
    </div>
    ${days.length
      ? `<ul class="issue-list">${days.map(d => `<li><span class="d">${d}</span><a href="/issue/${d}">AI Briefing — ${prettyDate(d)}</a></li>`).join('')}</ul>`
      : '<p class="lede">The first issue lands soon — <a href="/#newsletter">subscribe</a> to get it in your inbox.</p>'}`;

  const html = pageShell({
    title: 'Briefing issues',
    description: 'The PromptAI daily AI briefing, issue by issue — AI news, research papers and deep dives, archived and readable on the web.',
    canonical: 'https://promptai.in/issues',
    breadcrumbs: [{ label: 'Home', href: '/' }, { label: 'Issues' }],
    body,
  });
  return htmlResponse(html, 1800);
}
