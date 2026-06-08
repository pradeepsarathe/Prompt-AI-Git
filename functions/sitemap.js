// functions/sitemap.js
// Cloudflare Pages Function — dynamic sitemap for PromptAI
// Accessible at: /sitemap and /sitemap.xml (via _redirects)
//
// Why dynamic: <lastmod> is stamped at request time, so the homepage and
// archive (which refresh with the live AI feed daily) always report an
// honest, current freshness date to Google — no manual edits, no build step.
//
// Pages that rarely change use a fixed date below. Bump EDU_LASTMOD only
// when education.html actually changes in a meaningful way.

const EDU_LASTMOD = '2026-06-07'; // ← update this when education.html changes

export async function onRequest() {
  // Today's date in UTC, YYYY-MM-DD (W3C datetime, date-only form)
  const today = new Date().toISOString().slice(0, 10);

  const urls = [
    { loc: 'https://promptai.in/',             lastmod: today,      changefreq: 'hourly', priority: '1.0' },
    { loc: 'https://promptai.in/archive.html',  lastmod: today,      changefreq: 'daily',  priority: '0.8' },
    { loc: 'https://promptai.in/education.html', lastmod: EDU_LASTMOD, changefreq: 'weekly', priority: '0.7' },
  ];

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
