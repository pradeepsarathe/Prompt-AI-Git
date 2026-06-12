// functions/feed.js
// Cloudflare Pages Function — Live RSS feed for PromptAI
// Accessible at: /feed and /feed.xml (via _redirects)
// Subscribe URL for Buffer/Feedly/Zapier: https://promptai.in/feed.xml
//
// Now served from the shared KV feed cache (R1) — one KV read instead
// of re-fetching HN/arXiv/TechCrunch on every hit. Falls back to a
// minimal live fetch only when the cache is cold.

import { readFeedPayload, fetchHNStories, fetchPapers, withTimeout } from './lib/feedlib.js';
import { SRC_META } from './lib/sources.js';

export async function onRequest(context) {
  const { env } = context;
  let items = [];

  const payload = env.STATS ? await readFeedPayload(env.STATS) : null;
  if (payload && (payload.news.length + payload.papers.length) > 0) {
    payload.news.slice(0, 22).forEach(s => items.push({
      title: s.title, link: s.url, desc: s.desc || '',
      date: s.ts ? new Date(s.ts).toUTCString() : new Date().toUTCString(),
      cat: (SRC_META[s.src] && SRC_META[s.src].label) || s.src || 'News',
    }));
    payload.papers.slice(0, 8).forEach(p => items.push({
      title: p.title, link: p.url, desc: p.desc || '',
      date: p.date ? new Date(p.date).toUTCString() : new Date().toUTCString(),
      cat: 'arXiv Paper',
    }));
  } else {
    // Cold-cache fallback: one light live pass.
    const [hn, papers] = await Promise.all([
      withTimeout(fetchHNStories(10), 8000, []),
      withTimeout(fetchPapers('all', 8), 8000, []),
    ]);
    hn.forEach(s => items.push({ title: s.title, link: s.url, desc: s.desc || `${s.score || 0} points on Hacker News`, date: new Date(s.ts || Date.now()).toUTCString(), cat: 'Hacker News' }));
    papers.forEach(p => items.push({ title: p.title, link: p.url, desc: p.desc || '', date: new Date().toUTCString(), cat: 'arXiv Paper' }));
  }

  // Sort newest first, dedupe by link
  const seen = new Set();
  const deduped = items
    .filter(i => i.link && !seen.has(i.link) && seen.add(i.link))
    .sort((a, b) => new Date(b.date) - new Date(a.date))
    .slice(0, 30);

  const esc = s => (s || '').replace(/&/g, '&amp;').replace(/</g, '&lt;').replace(/>/g, '&gt;');

  const xml = `<?xml version="1.0" encoding="UTF-8"?>
<rss version="2.0" xmlns:atom="http://www.w3.org/2005/Atom">
  <channel>
    <title>PromptAI — AI Research Hub</title>
    <link>https://promptai.in</link>
    <description>Curated AI papers, research news, and insights — updated daily.</description>
    <language>en-us</language>
    <lastBuildDate>${new Date().toUTCString()}</lastBuildDate>
    <atom:link href="https://promptai.in/feed.xml" rel="self" type="application/rss+xml"/>
    ${deduped.map(i => `<item>
      <title><![CDATA[${i.title}]]></title>
      <link>${esc(i.link)}</link>
      <guid isPermaLink="true">${esc(i.link)}</guid>
      <description><![CDATA[${i.desc}]]></description>
      <pubDate>${i.date}</pubDate>
      <category>${esc(i.cat)}</category>
    </item>`).join('\n    ')}
  </channel>
</rss>`;

  return new Response(xml, {
    status: 200,
    headers: {
      'Content-Type': 'application/rss+xml; charset=utf-8',
      'Cache-Control': 'public, max-age=1800',
      'Access-Control-Allow-Origin': '*',
    },
  });
}
