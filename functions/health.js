// functions/health.js
// ═══════════════════════════════════════════════════════════════════
// GET /health — ops health endpoint (R9/R41).
//
// Two access levels:
//   • Unauthenticated (uptime monitors — UptimeRobot / CF Health Checks):
//       { ok, feedsAgeMin } — 200 when healthy, 503 when the feed cache
//       is missing or older than 3 hours (cron is dead).
//   • Authorization: Bearer <CRON_SECRET> (or ?key=):
//       full report — digest meta:lastRun, feeds meta:feedsLastRun,
//       subscriber + archive counts, binding presence.
//
// Point UptimeRobot at: https://promptai.in/health  (keyword "ok":true)
// ═══════════════════════════════════════════════════════════════════

import { readFeedPayload } from './lib/feedlib.js';

const json = (obj, status = 200) =>
  new Response(JSON.stringify(obj, null, 2), {
    status,
    headers: { 'Content-Type': 'application/json', 'Cache-Control': 'no-store' },
  });

const STALE_MS = 3 * 60 * 60 * 1000;

export async function onRequest(context) {
  const { request, env } = context;
  const url = new URL(request.url);

  const payload = env.STATS ? await readFeedPayload(env.STATS) : null;
  const ageMs = payload ? Date.now() - Date.parse(payload.generatedAt || 0) : null;
  const feedsOk = ageMs != null && ageMs < STALE_MS;

  const authz = request.headers.get('Authorization') || '';
  const presented = authz.startsWith('Bearer ') ? authz.slice(7).trim() : (url.searchParams.get('key') || '');
  const authed = !!env.CRON_SECRET && presented === env.CRON_SECRET;

  if (!authed) {
    return json({ ok: feedsOk, feedsAgeMin: ageMs != null ? Math.round(ageMs / 60000) : null }, feedsOk ? 200 : 503);
  }

  // ── full authenticated report ──
  const report = {
    ok: feedsOk,
    at: new Date().toISOString(),
    bindings: { STATS: !!env.STATS, SUBSCRIBERS: !!env.SUBSCRIBERS, USERS: !!env.USERS, AI: !!env.AI },
    feeds: payload ? {
      generatedAt: payload.generatedAt,
      ageMin: Math.round(ageMs / 60000),
      counts: { news: payload.news.length, blogs: payload.blogs.length, papers: payload.papers.length },
      hasSummary: !!payload.summary,
    } : null,
  };

  if (env.STATS) {
    try { report.feedsLastRun = JSON.parse(await env.STATS.get('meta:feedsLastRun') || 'null'); } catch (e) {}
    try {
      const arch = JSON.parse(await env.STATS.get('arch:all') || '[]');
      report.archive = { hot: Array.isArray(arch) ? arch.length : 0 };
    } catch (e) {}
  }
  if (env.SUBSCRIBERS) {
    try { report.digestLastRun = JSON.parse(await env.SUBSCRIBERS.get('meta:lastRun') || 'null'); } catch (e) {}
    try {
      let n = 0, pending = 0, cursor;
      do {
        const page = await env.SUBSCRIBERS.list({ cursor, limit: 1000 });
        page.keys.forEach(k => {
          if (k.name.startsWith('pending:')) pending++;
          else if (!k.name.startsWith('rl:') && !k.name.startsWith('meta:')) n++;
        });
        cursor = page.list_complete ? null : page.cursor;
      } while (cursor);
      report.subscribers = { active: n, pending };
    } catch (e) {}
  }

  return json(report, feedsOk ? 200 : 503);
}
