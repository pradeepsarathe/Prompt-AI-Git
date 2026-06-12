// functions/api/refresh-feeds.js
// ═══════════════════════════════════════════════════════════════════
// GET/POST /api/refresh-feeds — the aggregation Worker's heartbeat (R1).
//
// Schedule this every 30 minutes with the same external cron service
// that triggers /send-digest (cron-job.org etc.):
//
//   URL:    https://promptai.in/api/refresh-feeds
//   Header: Authorization: Bearer <CRON_SECRET>
//
// Each run:
//   1. Fetches all sources server-side (lib/sources.js — R2)
//   2. Generates the "Today in 60 seconds" AI summary (R30, env.AI)
//   3. Writes the aggregated payload to KV → served by /api/feeds
//   4. Merges stories into the shared archive (single writer — R3)
//      with monthly segment rollover (R36)
//   5. Snapshots today's briefing → /issue/<YYYY-MM-DD> pages (R21/R39)
// ═══════════════════════════════════════════════════════════════════

import { buildFeedPayload, mergeIntoArchive, readFeedPayload, FEEDS_KEY } from '../lib/feedlib.js';

const json = (obj, status = 200) =>
  new Response(JSON.stringify(obj, null, 2), {
    status,
    headers: { 'Content-Type': 'application/json', 'Cache-Control': 'no-store' },
  });

export async function onRequest(context) {
  const { request, env } = context;
  const url = new URL(request.url);

  const authz = request.headers.get('Authorization') || '';
  const presented = authz.startsWith('Bearer ') ? authz.slice(7).trim() : (url.searchParams.get('key') || '');
  if (!env.CRON_SECRET || presented !== env.CRON_SECRET) return json({ error: 'Unauthorized' }, 401);
  if (!env.STATS) return json({ error: 'No STATS KV binding' }, 503);

  const startedAt = Date.now();
  try {
    const payload = await buildFeedPayload(env, { skipAI: false });
    const counts = { news: payload.news.length, blogs: payload.blogs.length, papers: payload.papers.length };
    if (counts.news + counts.blogs + counts.papers === 0) {
      return json({ error: 'All feeds failed — kept previous cache', counts }, 200);
    }

    // Keep the previous summary if the AI binding is missing / timed out.
    if (!payload.summary) {
      const prev = await readFeedPayload(env.STATS);
      if (prev && prev.summary) payload.summary = prev.summary;
    }

    // Subscriber count for honest social proof (R32) — rounded down to
    // the nearest 25 and only surfaced by the UI when >= 100.
    if (env.SUBSCRIBERS) {
      try {
        let n = 0, cursor;
        do {
          const page = await env.SUBSCRIBERS.list({ cursor, limit: 1000 });
          n += page.keys.filter(k => !k.name.startsWith('rl:') && !k.name.startsWith('pending:') && !k.name.startsWith('meta:')).length;
          cursor = page.list_complete ? null : page.cursor;
        } while (cursor);
        payload.meta.subscribers = Math.floor(n / 25) * 25;
        payload.meta.subscribersExact = undefined;
      } catch (e) { /* non-fatal */ }
    }

    await env.STATS.put(FEEDS_KEY, JSON.stringify(payload));
    const arch = await mergeIntoArchive(env.STATS, payload);

    // Daily issue snapshot — same-day runs overwrite, so the issue page
    // always shows the day's final state.
    const day = new Date().toISOString().slice(0, 10);
    const issue = {
      date: day,
      generatedAt: payload.generatedAt,
      summary: payload.summary,
      news: payload.news.slice(0, 10).map(pickIssueFields),
      blogs: payload.blogs.slice(0, 5).map(pickIssueFields),
      paper: payload.papers[0] ? pickIssueFields(payload.papers[0]) : null,
    };
    await env.STATS.put('issue:' + day, JSON.stringify(issue));

    // Health breadcrumb for /health (R9/R41).
    await env.STATS.put('meta:feedsLastRun', JSON.stringify({
      at: new Date().toISOString(), ms: Date.now() - startedAt, counts,
      summary: !!payload.summary, archive: arch,
    }));

    return json({ success: true, ms: Date.now() - startedAt, counts, summary: !!payload.summary, archive: arch, issue: day });
  } catch (err) {
    return json({ error: 'refresh-feeds crashed', detail: String(err && err.message || err) }, 200);
  }
}

function pickIssueFields(s) {
  return { title: s.title, url: s.url, desc: (s.desc || '').slice(0, 240), src: s.src, topic: s.topic || s.cat || '' };
}
