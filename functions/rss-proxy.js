// functions/rss-proxy.js
// Cloudflare Pages Function — RSS proxy, bypasses CORS
// Deployed at: /rss-proxy?url=<encoded_feed_url>
//
// Kept as a fallback for the client-side feed engine (used only when
// /api/feeds is unavailable). The allow-list is DERIVED from the single
// sources module (R2) — add a feed there and the proxy allows it.

import { ALLOWED_DOMAINS } from './lib/sources.js';

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

  const ok = ALLOWED_DOMAINS.some(d => host === d || host.endsWith('.' + d) || ('www.' + host) === d);
  if (!ok) {
    return new Response(JSON.stringify({ error: 'Domain not allowed' }), {
      status: 403,
      headers: { 'Content-Type': 'application/json', 'Access-Control-Allow-Origin': '*' },
    });
  }

  try {
    const response = await fetch(feedUrl, {
      headers: {
        // Use a real browser UA — several feeds (VentureBeat, Unite.AI, etc.)
        // sit behind WAFs that block non-browser User-Agents with a 403.
        'User-Agent': 'Mozilla/5.0 (Windows NT 10.0; Win64; x64) AppleWebKit/537.36 (KHTML, like Gecko) Chrome/124.0.0.0 Safari/537.36',
        'Accept': 'application/rss+xml, application/atom+xml, application/xml, text/xml, text/html, */*',
        'Accept-Language': 'en-US,en;q=0.9',
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
