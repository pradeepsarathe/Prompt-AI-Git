// netlify/functions/rss-proxy.js
// Serverless RSS proxy — runs on Netlify's Node.js server, bypasses CORS entirely
// Called from browser as: /.netlify/functions/rss-proxy?url=<encoded_feed_url>

exports.handler = async (event) => {
  const feedUrl = event.queryStringParameters && event.queryStringParameters.url;

  if (!feedUrl) {
    return { statusCode: 400, body: JSON.stringify({ error: 'Missing url parameter' }) };
  }

  // Whitelist allowed domains — security measure
  const ALLOWED = [
    'rss.arxiv.org', 'www.technologyreview.com', 'techcrunch.com',
    'aimagazine.com', 'openai.com', 'sloanreview.mit.edu',
    'www.analyticsinsight.net', 'www.wired.com', 'thegradient.pub',
    'medium.com', 'deepmind.google', 'export.arxiv.org',
    'hacker-news.firebaseio.com'
  ];

  let host;
  try { host = new URL(feedUrl).hostname; } catch(e) {
    return { statusCode: 400, body: JSON.stringify({ error: 'Invalid URL' }) };
  }

  if (!ALLOWED.some(d => host === d || host.endsWith('.' + d))) {
    return { statusCode: 403, body: JSON.stringify({ error: 'Domain not allowed' }) };
  }

  try {
    const response = await fetch(feedUrl, {
      headers: {
        'User-Agent': 'PromptAI-RSS-Reader/1.0 (+https://promptai.in)',
        'Accept': 'application/rss+xml, application/atom+xml, application/xml, text/xml, */*'
      },
      signal: AbortSignal.timeout(8000)
    });

    const body = await response.text();

    return {
      statusCode: 200,
      headers: {
        'Content-Type': response.headers.get('content-type') || 'application/xml',
        'Access-Control-Allow-Origin': '*',
        'Cache-Control': 'public, max-age=1800' // cache 30 mins on CDN
      },
      body
    };
  } catch (err) {
    return {
      statusCode: 502,
      body: JSON.stringify({ error: 'Fetch failed', detail: err.message })
    };
  }
};
