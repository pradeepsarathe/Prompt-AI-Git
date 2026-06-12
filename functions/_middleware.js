// functions/_middleware.js
// ═══════════════════════════════════════════════════════════════════
// Server-renders today's headlines into the homepage HTML (R19).
//
// The homepage is a JS app — crawlers historically got an empty shell.
// This middleware intercepts "/" only, and replaces the
// <!--SSR:HOME--> placeholder in index.html with real, visible HTML:
// the AI "Today in 60 seconds" summary + today's top headlines as
// plain links, straight from the KV feed cache. The client app then
// replaces it with the live interactive feed once it boots (the block
// is inside #ssr-home, which pai-google-ui.js hides when ready).
//
// Zero extra latency for every other route — they pass straight through.
// ═══════════════════════════════════════════════════════════════════

import { readFeedPayload, esc } from './lib/feedlib.js';

export async function onRequest(context) {
  const { request, env, next } = context;
  const url = new URL(request.url);

  if ((url.pathname !== '/' && url.pathname !== '/index.html') || request.method !== 'GET') {
    return next();
  }

  const res = await next();
  const type = res.headers.get('content-type') || '';
  if (!type.includes('text/html') || !env.STATS) return res;

  let html;
  try { html = await res.text(); } catch (e) { return res; }
  if (!html.includes('<!--SSR:HOME-->')) {
    return new Response(html, res);
  }

  let block = '';
  try {
    const payload = await readFeedPayload(env.STATS);
    if (payload && payload.news && payload.news.length) {
      const day = (payload.generatedAt || '').slice(0, 10);
      const bullets = payload.summary && payload.summary.bullets ? payload.summary.bullets : [];
      block = `
<section id="ssr-home" aria-label="Today's AI headlines">
  ${bullets.length ? `<div class="ssr-summary">
    <h2>Today in 60 seconds</h2>
    <ul>${bullets.map(b => `<li>${esc(b)}</li>`).join('')}</ul>
  </div>` : ''}
  <h2>Top AI stories right now</h2>
  <ul class="ssr-headlines">
    ${payload.news.slice(0, 12).map(s => `<li><a href="${esc(s.url)}" rel="noopener">${esc(s.title)}</a>${s.src ? ` <span>(${esc(s.src)})</span>` : ''}</li>`).join('\n    ')}
  </ul>
  ${payload.papers && payload.papers[0] ? `<h2>Latest research</h2>
  <ul class="ssr-headlines">
    ${payload.papers.slice(0, 5).map(p => `<li><a href="${esc(p.url)}" rel="noopener">${esc(p.title)}</a></li>`).join('\n    ')}
  </ul>` : ''}
  <p class="ssr-more">${day ? `<a href="/issue/${day}">Read today's full briefing →</a> · ` : ''}<a href="/issues">All issues</a> · <a href="/prompts.html">Prompt library</a></p>
</section>`;
    }
  } catch (e) { /* serve unmodified page */ }

  const out = html.replace('<!--SSR:HOME-->', block);
  const headers = new Headers(res.headers);
  headers.delete('content-length');
  return new Response(out, { status: res.status, headers });
}
