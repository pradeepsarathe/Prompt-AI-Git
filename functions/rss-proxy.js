// functions/rss-proxy.js
// Cloudflare Pages Function — RSS proxy, bypasses CORS
// Deployed at: /rss-proxy?url=<encoded_feed_url>

const ALLOWED = [
  'rss.arxiv.org', 'export.arxiv.org',
  'techcrunch.com', 'venturebeat.com',
  'www.theverge.com', 'feeds.arstechnica.com',
  'thegradient.pub', 'medium.com',
  'blog.research.google', 'openai.com',
  'sloanreview.mit.edu', 'www.analyticsinsight.net',
  'api.rss2json.com',
  'www.anthropic.com', 'huggingface.co',
  'www.deeplearning.ai', 'ai.meta.com',
  'blog.perplexity.ai', 'mistral.ai',
  'cohere.com', 'www.databricks.com',
  'blog.langchain.dev', 'wandb.ai',
  // Alt research sources
  'spectrum.ieee.org',
  'www.sciencedaily.com',
  'www.jmlr.org',
  // Educational blogs
  'www.fast.ai', 'distill.pub',
  'interconnects.ai',
];

export async function onRequest(context) {
  const { request } = context;
  const url = new URL(request.url);
  const feedUrl = url.searchParams.get('url');

  // CORS preflight
  if (request.method === 'OPTIONS') {
    return new Response(null, {
      headers: {
        'Access-Control-Allow-Origin': '*',
        'Access-Control-Allow-Methods': 'GET, OPTIONS',
        'Access-Control-Allow-Headers': 'Content-Type',
      },
    });
  }

  if (!feedUrl) {
    return new Response(JSON.stringify({ error: 'Missing url parameter' }), {
      status: 400,
      headers: { 'Content-Type': 'application/json', 'Access-Control-Allow-Origin': '*' },
    });
  }

  let host;
  try { host = new URL(feedUrl).hostname; } catch (e) {
    return new Response(JSON.stringify({ error: 'Invalid URL' }), {
      status: 400,
      headers: { 'Content-Type': 'application/json', 'Access-Control-Allow-Origin': '*' },
    });
  }

  if (!ALLOWED.some(d => host === d || host.endsWith('.' + d))) {
    return new Response(JSON.stringify({ error: 'Domain not allowed' }), {
      status: 403,
      headers: { 'Content-Type': 'application/json', 'Access-Control-Allow-Origin': '*' },
    });
  }

  try {
    const response = await fetch(feedUrl, {
      headers: {
        'User-Agent': 'PromptAI-RSS-Reader/1.0 (+https://promptai.in)',
        'Accept': 'application/rss+xml, application/atom+xml, application/xml, text/xml, */*',
      },
      cf: { cacheTtl: 1800, cacheEverything: true }, // Cloudflare edge cache 30 min
    });

    const body = await response.text();

    return new Response(body, {
      status: 200,
      headers: {
        'Content-Type': response.headers.get('content-type') || 'application/xml',
        'Access-Control-Allow-Origin': '*',
        'Cache-Control': 'public, max-age=1800',
      },
    });
  } catch (err) {
    return new Response(JSON.stringify({ error: 'Fetch failed', detail: err.message }), {
      status: 502,
      headers: { 'Content-Type': 'application/json', 'Access-Control-Allow-Origin': '*' },
    });
  }
}
