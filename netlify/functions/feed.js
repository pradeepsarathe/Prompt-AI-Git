// netlify/functions/feed.js
// Live RSS feed for PromptAI — served at https://promptai.in/feed.xml
// Combines HN AI stories + arXiv papers — refreshed every 30 min by Netlify CDN cache
// Buffer/Feedly/Zapier can subscribe to: https://promptai.in/feed.xml

exports.handler = async () => {
  const items = [];
  const aiKw  = /\b(AI|LLM|GPT|claude|gemini|llama|transformer|machine learning|deep learning|neural|openai|anthropic|mistral|diffusion|RAG|agent|chatbot|copilot|inference|embedding)\b/i;

  // ── 1. Hacker News top AI stories ──────────────────────────────
  try {
    const hnRes  = await fetch('https://hacker-news.firebaseio.com/v0/topstories.json', { signal: AbortSignal.timeout(6000) });
    const ids    = (await hnRes.json()).slice(0, 40);
    const stories = await Promise.all(
      ids.map(id =>
        fetch(`https://hacker-news.firebaseio.com/v0/item/${id}.json`, { signal: AbortSignal.timeout(4000) })
          .then(r => r.json()).catch(() => null)
      )
    );
    stories
      .filter(s => s && s.title && aiKw.test(s.title))
      .slice(0, 12)
      .forEach(s => items.push({
        title: s.title,
        link:  s.url || `https://news.ycombinator.com/item?id=${s.id}`,
        desc:  `${s.score || 0} points on Hacker News · ${s.descendants || 0} comments`,
        date:  new Date((s.time || Date.now() / 1000) * 1000).toUTCString(),
        cat:   'Hacker News'
      }));
  } catch(e) { console.error('HN fetch error:', e.message); }

  // ── 2. arXiv cs.AI + cs.LG + cs.CL (via rss2json free tier) ───
  try {
    const arxivUrl = 'https://rss.arxiv.org/rss/cs.AI+cs.LG+cs.CL';
    const r    = await fetch(
      `https://api.rss2json.com/v1/api.json?rss_url=${encodeURIComponent(arxivUrl)}`,
      { signal: AbortSignal.timeout(8000) }
    );
    const data = await r.json();
    if (data.status === 'ok' && data.items?.length) {
      data.items.slice(0, 8).forEach(item => items.push({
        title: (item.title || '').replace(/\[.*?\]/g, '').trim(),
        link:  item.link || item.guid || '',
        desc:  (item.description || '').replace(/<[^>]+>/g, '').trim().slice(0, 400),
        date:  item.pubDate ? new Date(item.pubDate).toUTCString() : new Date().toUTCString(),
        cat:   'arXiv Paper'
      }));
    }
  } catch(e) { console.error('arXiv fetch error:', e.message); }

  // ── 3. TechCrunch AI (via rss2json) ────────────────────────────
  try {
    const tcUrl = 'https://techcrunch.com/category/artificial-intelligence/feed/';
    const r    = await fetch(
      `https://api.rss2json.com/v1/api.json?rss_url=${encodeURIComponent(tcUrl)}`,
      { signal: AbortSignal.timeout(8000) }
    );
    const data = await r.json();
    if (data.status === 'ok' && data.items?.length) {
      data.items.slice(0, 5).forEach(item => items.push({
        title: (item.title || '').trim(),
        link:  item.link || '',
        desc:  (item.description || '').replace(/<[^>]+>/g, '').trim().slice(0, 400),
        date:  item.pubDate ? new Date(item.pubDate).toUTCString() : new Date().toUTCString(),
        cat:   'TechCrunch'
      }));
    }
  } catch(e) { console.error('TC fetch error:', e.message); }

  // Sort newest first, dedupe by link
  const seen = new Set();
  const deduped = items
    .filter(i => i.link && !seen.has(i.link) && seen.add(i.link))
    .sort((a, b) => new Date(b.date) - new Date(a.date))
    .slice(0, 30);

  const escape = s => (s || '').replace(/&/g,'&amp;').replace(/</g,'&lt;').replace(/>/g,'&gt;');

  const xml = `<?xml version="1.0" encoding="UTF-8"?>
<rss version="2.0" xmlns:atom="http://www.w3.org/2005/Atom" xmlns:content="http://purl.org/rss/1.0/modules/content/">
  <channel>
    <title>PromptAI — AI Research Hub</title>
    <link>https://promptai.in</link>
    <description>Curated AI papers, breaking research news, tool reviews and expert analysis — updated daily from arXiv, Hacker News, TechCrunch and more.</description>
    <language>en-us</language>
    <lastBuildDate>${new Date().toUTCString()}</lastBuildDate>
    <managingEditor>hello@promptai.in (PromptAI)</managingEditor>
    <image>
      <url>https://promptai.in/og-image.png</url>
      <title>PromptAI</title>
      <link>https://promptai.in</link>
    </image>
    <atom:link href="https://promptai.in/feed.xml" rel="self" type="application/rss+xml"/>
    ${deduped.map(i => `<item>
      <title><![CDATA[${i.title}]]></title>
      <link>${escape(i.link)}</link>
      <guid isPermaLink="true">${escape(i.link)}</guid>
      <description><![CDATA[${i.desc}]]></description>
      <pubDate>${i.date}</pubDate>
      <category>${escape(i.cat)}</category>
    </item>`).join('\n    ')}
  </channel>
</rss>`;

  return {
    statusCode: 200,
    headers: {
      'Content-Type':  'application/rss+xml; charset=utf-8',
      'Cache-Control': 'public, max-age=1800',   // CDN caches 30 min
      'Access-Control-Allow-Origin': '*'
    },
    body: xml
  };
};
