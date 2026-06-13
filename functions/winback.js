// functions/winback.js
// Cloudflare Pages Function — DORMANT WIN-BACK + optional sunset.
//
// Hit by a weekly cron (e.g. Thursday 09:00 IST):
//   GET https://promptai.in/winback?key=YOUR_CRON_SECRET
//   — or — Authorization: Bearer YOUR_CRON_SECRET
//
// "Dormant" = a subscriber whose last engagement is older than DORMANT_DAYS.
// Engagement is the most recent of:  welcome.lastAt · lastOpenAt · confirmedAt
// · subscribedAt.  lastOpenAt is stamped by the open pixel (functions/e/open.js)
// that send-digest.js embeds in every briefing — so this gets sharper the
// longer the pixel has been live. Until then it falls back to confirm date,
// which is why the first win-backs only fire for genuinely old subscribers.
//
// Flow per run:
//   1. Skip the freshly-confirmed and anyone still inside the welcome series.
//   2. Send ONE win-back to each dormant subscriber, at most once every
//      RESEND_GAP_DAYS (so the weekly cron never re-nudges the same person).
//   3. SUNSET (only with &sunset=1): a subscriber who got a win-back
//      ≥ SUNSET_AFTER_DAYS ago and is STILL dormant gets frequency:'paused'.
//      Paused records are excluded from send-digest.js — they stop receiving
//      briefings but stay on the list (and can be reactivated from the site).
//      Sunset is OFF by default; turn it on once you trust the open data.
//
// Dry run: &dry=1  (reports who's dormant / who'd be sunset, sends nothing)
//
// Required: KV SUBSCRIBERS · RESEND_API_KEY · FROM_EMAIL · CRON_SECRET.

import { winbackEmail } from './lib/welcomelib.js';
import { unsubscribeUrl } from './lib/feedlib.js';

const DAY = 86400000;
const DORMANT_DAYS = 60;     // no engagement in this many days → dormant
const RESEND_GAP_DAYS = 90;  // don't win-back the same person more often than this
const SUNSET_AFTER_DAYS = 30; // win-back this old + still dormant → pause (sunset mode)
const MIN_AGE_DAYS = 30;     // never win-back anyone who confirmed < 30 days ago

export async function onRequest(context) {
  const { request, env } = context;
  const url = new URL(request.url);

  const authz = request.headers.get('Authorization') || '';
  const presentedKey = authz.startsWith('Bearer ') ? authz.slice(7).trim() : (url.searchParams.get('key') || '');
  if (!env.CRON_SECRET || presentedKey !== env.CRON_SECRET) return json({ error: 'Unauthorized' }, 401);
  if (!env.SUBSCRIBERS) return json({ error: 'No SUBSCRIBERS KV binding' }, 503);

  const dry = url.searchParams.get('dry') === '1';
  const sunset = url.searchParams.get('sunset') === '1';
  if (!dry && (!env.RESEND_API_KEY || !env.FROM_EMAIL)) {
    return json({ error: 'Email not configured (RESEND_API_KEY / FROM_EMAIL)' }, 503);
  }

  try {
    const now = Date.now();

    let keys = [];
    let cursor;
    do {
      const page = await env.SUBSCRIBERS.list({ cursor, limit: 1000 });
      page.keys.forEach((k) => keys.push(k.name));
      cursor = page.list_complete ? null : page.cursor;
    } while (cursor);
    keys = keys.filter((e) => e && !e.startsWith('rl:') && !e.startsWith('pending:') && !e.startsWith('meta:'));

    const due = [];        // dormant → send win-back
    const toSunset = [];   // got win-back long ago, still dormant → pause
    for (let i = 0; i < keys.length; i += 50) {
      const chunk = keys.slice(i, i + 50);
      const recs = await Promise.all(chunk.map((e) => env.SUBSCRIBERS.get(e).catch(() => null)));
      recs.forEach((raw, k) => {
        if (!raw) return;
        let rec;
        try { rec = JSON.parse(raw); } catch (e) { return; }
        if (!rec || rec.status === 'unsubscribed' || rec.frequency === 'paused') return;

        // Still being welcomed? Leave them alone.
        const w = rec.welcome;
        if (w && w.enrolledAt && !(Array.isArray(w.sent) && w.sent.includes(3))) return;

        const anchor = (ts) => (ts ? new Date(ts).getTime() : 0);
        const confirmTs = anchor(rec.confirmedAt) || anchor(rec.subscribedAt);
        if (!confirmTs || (now - confirmTs) < MIN_AGE_DAYS * DAY) return; // too new

        const lastEngaged = Math.max(
          anchor(rec.lastOpenAt), anchor(rec.welcome && rec.welcome.lastAt), confirmTs
        );
        const dormantFor = (now - lastEngaged) / DAY;
        if (dormantFor < DORMANT_DAYS) return; // still engaged

        const lastWinback = anchor(rec.winback && rec.winback.sentAt);

        // Sunset candidate: previously nudged, enough time passed, still dormant.
        if (lastWinback && (now - lastWinback) >= SUNSET_AFTER_DAYS * DAY) {
          toSunset.push({ email: chunk[k], rec });
          return;
        }
        // Win-back candidate: never nudged, or last nudge older than the gap.
        if (!lastWinback || (now - lastWinback) >= RESEND_GAP_DAYS * DAY) {
          due.push({ email: chunk[k], rec });
        }
      });
    }

    if (dry) {
      return json({
        dryRun: true, sunsetMode: sunset, subscribers: keys.length,
        winbackDue: due.length, sunsetDue: toSunset.length,
        sampleWinback: due.slice(0, 10).map((d) => mask(d.email)),
        sampleSunset: toSunset.slice(0, 10).map((d) => mask(d.email)),
      });
    }

    // ── send win-backs (batched) ──
    const sleep = (ms) => new Promise((r) => setTimeout(r, ms));
    let sent = 0;
    let lastResendError = null;
    const delivered = [];
    for (let i = 0; i < due.length; i += 100) {
      const chunk = due.slice(i, i + 100);
      const batch = await Promise.all(chunk.map(async (d) => {
        const unsub = await unsubscribeUrl(env, d.email);
        const mail = winbackEmail({ email: d.email, unsubUrl: unsub });
        return {
          from: env.FROM_EMAIL, to: [d.email],
          subject: mail.subject, html: mail.html, text: mail.text,
          headers: { 'List-Unsubscribe': '<' + unsub + '>', 'List-Unsubscribe-Post': 'List-Unsubscribe=One-Click' },
        };
      }));
      try {
        const r = await fetch('https://api.resend.com/emails/batch', {
          method: 'POST',
          headers: { 'Authorization': 'Bearer ' + env.RESEND_API_KEY, 'Content-Type': 'application/json' },
          body: JSON.stringify(batch),
        });
        if (r.ok) { sent += chunk.length; delivered.push(...chunk); }
        else lastResendError = (await r.text()).slice(0, 300);
      } catch (e) { lastResendError = e.message; }
      if (i + 100 < due.length) await sleep(600);
    }

    let marked = 0;
    for (const d of delivered) {
      try {
        const raw = await env.SUBSCRIBERS.get(d.email);
        const rec = raw ? JSON.parse(raw) : d.rec;
        rec.winback = { sentAt: new Date().toISOString(), count: ((rec.winback && rec.winback.count) || 0) + 1 };
        await env.SUBSCRIBERS.put(d.email, JSON.stringify(rec));
        marked++;
      } catch (e) { /* re-nudge avoided by the gap on next run regardless */ }
    }

    // ── sunset (pause) — only when explicitly enabled ──
    let paused = 0;
    if (sunset) {
      for (const d of toSunset) {
        try {
          const raw = await env.SUBSCRIBERS.get(d.email);
          const rec = raw ? JSON.parse(raw) : d.rec;
          rec.frequency = 'paused';
          rec.pausedAt = new Date().toISOString();
          rec.pausedReason = 'dormant-sunset';
          await env.SUBSCRIBERS.put(d.email, JSON.stringify(rec));
          paused++;
        } catch (e) { /* non-fatal */ }
      }
    }

    try {
      await env.SUBSCRIBERS.put('meta:lastWinbackRun', JSON.stringify({
        at: new Date().toISOString(), subscribers: keys.length,
        winbackDue: due.length, sent, marked, sunsetMode: sunset, sunsetDue: toSunset.length, paused, lastResendError,
      }));
    } catch (e) { /* non-fatal */ }

    return json({ success: true, subscribers: keys.length, winbackDue: due.length, sent, marked, sunsetMode: sunset, paused, lastResendError });
  } catch (err) {
    return json({ error: 'winback crashed', detail: String((err && err.message) || err) }, 200);
  }
}

function mask(email) {
  const [u, d] = String(email).split('@');
  if (!d) return email;
  return (u.length <= 2 ? u[0] + '*' : u.slice(0, 2) + '***') + '@' + d;
}

function json(obj, status = 200) {
  return new Response(JSON.stringify(obj, null, 2), {
    status, headers: { 'Content-Type': 'application/json', 'Access-Control-Allow-Origin': '*' },
  });
}
