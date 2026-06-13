// functions/welcome-series.js
// Cloudflare Pages Function — the WELCOME-SERIES drip.
//
// Hit by a daily cron (one schedule is enough):
//   GET https://promptai.in/welcome-series?key=YOUR_CRON_SECRET
//   — or — Authorization: Bearer YOUR_CRON_SECRET   (preferred; query strings
//   end up in logs, same convention as send-digest.js / weekly-report.js)
//
// What it does each run:
//   1. Lists every active subscriber (skips rl:/pending:/meta: bookkeeping keys).
//   2. Only considers subscribers ENROLLED in the series — i.e. records that
//      carry a `welcome` object (set by confirm.js at confirmation time).
//      Everyone who confirmed BEFORE this feature shipped has no `welcome`
//      field and is silently skipped, so the back-catalogue is never spammed.
//   3. For each, finds the next un-sent step whose day-threshold has passed and
//      queues exactly ONE email (so a lapsed cron can't fire 1+2+3 at once).
//        step 1 → ≥ 1 day after enrolment   (orientation)
//        step 2 → ≥ 3 days                   (prompt library)
//        step 3 → ≥ 6 days                   (make it yours)
//   4. Sends the queued emails via Resend's batch endpoint (≤100/req) and marks
//      progress back onto each subscriber record (welcome.sent + welcome.lastAt).
//
// Dry run (no send, just a report of who is due):
//   GET /welcome-series?key=...&dry=1
//
// Required: KV SUBSCRIBERS · RESEND_API_KEY · FROM_EMAIL · CRON_SECRET.

import { welcomeEmail } from './lib/welcomelib.js';
import { unsubscribeUrl } from './lib/feedlib.js';

// Day thresholds per step (days since welcome.enrolledAt).
const STEP_AFTER_DAYS = { 1: 1, 2: 3, 3: 6 };
const DAY = 86400000;

export async function onRequest(context) {
  const { request, env } = context;
  const url = new URL(request.url);

  const authz = request.headers.get('Authorization') || '';
  const presentedKey = authz.startsWith('Bearer ') ? authz.slice(7).trim() : (url.searchParams.get('key') || '');
  if (!env.CRON_SECRET || presentedKey !== env.CRON_SECRET) return json({ error: 'Unauthorized' }, 401);
  if (!env.SUBSCRIBERS) return json({ error: 'No SUBSCRIBERS KV binding' }, 503);

  const dry = url.searchParams.get('dry') === '1';
  if (!dry && (!env.RESEND_API_KEY || !env.FROM_EMAIL)) {
    return json({ error: 'Email not configured (RESEND_API_KEY / FROM_EMAIL)' }, 503);
  }

  try {
    const now = Date.now();

    // ── gather subscriber keys ──
    let keys = [];
    let cursor;
    do {
      const page = await env.SUBSCRIBERS.list({ cursor, limit: 1000 });
      page.keys.forEach((k) => keys.push(k.name));
      cursor = page.list_complete ? null : page.cursor;
    } while (cursor);
    keys = keys.filter((e) => e && !e.startsWith('rl:') && !e.startsWith('pending:') && !e.startsWith('meta:'));

    // ── figure out who is due, one step each ──
    const due = []; // { email, step, rec }
    for (let i = 0; i < keys.length; i += 50) {
      const chunk = keys.slice(i, i + 50);
      const recs = await Promise.all(chunk.map((e) => env.SUBSCRIBERS.get(e).catch(() => null)));
      recs.forEach((raw, k) => {
        if (!raw) return;
        let rec;
        try { rec = JSON.parse(raw); } catch (e) { return; }
        const w = rec && rec.welcome;
        if (!w || !w.enrolledAt) return;             // not enrolled / grandfathered
        if (rec.status === 'unsubscribed') return;
        const sent = Array.isArray(w.sent) ? w.sent : [];
        const nextStep = [1, 2, 3].find((s) => !sent.includes(s));
        if (!nextStep) return;                        // series complete
        const ageDays = (now - new Date(w.enrolledAt).getTime()) / DAY;
        if (ageDays >= STEP_AFTER_DAYS[nextStep]) {
          due.push({ email: chunk[k], step: nextStep, rec });
        }
      });
    }

    if (dry) {
      return json({
        dryRun: true, subscribers: keys.length, due: due.length,
        breakdown: due.reduce((m, d) => ((m['step' + d.step] = (m['step' + d.step] || 0) + 1), m), {}),
        sample: due.slice(0, 10).map((d) => ({ email: mask(d.email), step: d.step })),
      });
    }
    if (due.length === 0) return json({ success: true, sent: 0, message: 'Nobody due for a welcome email right now.' });

    // ── build + send in batches of 100 ──
    const sleep = (ms) => new Promise((r) => setTimeout(r, ms));
    let sent = 0;
    let lastResendError = null;
    const delivered = []; // entries we may now mark as sent

    for (let i = 0; i < due.length; i += 100) {
      const chunk = due.slice(i, i + 100);
      const batch = await Promise.all(chunk.map(async (d) => {
        const unsub = await unsubscribeUrl(env, d.email);
        const mail = welcomeEmail(d.step, { email: d.email, unsubUrl: unsub });
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

    // ── mark progress (only for batches that actually went out) ──
    let marked = 0;
    for (const d of delivered) {
      try {
        const raw = await env.SUBSCRIBERS.get(d.email);
        const rec = raw ? JSON.parse(raw) : d.rec;
        rec.welcome = rec.welcome || { enrolledAt: new Date().toISOString(), sent: [] };
        rec.welcome.sent = Array.isArray(rec.welcome.sent) ? rec.welcome.sent : [];
        if (!rec.welcome.sent.includes(d.step)) rec.welcome.sent.push(d.step);
        rec.welcome.lastAt = new Date().toISOString();
        await env.SUBSCRIBERS.put(d.email, JSON.stringify(rec));
        marked++;
      } catch (e) { /* a missed mark just means a possible re-send next run */ }
    }

    if (env.SUBSCRIBERS) {
      try {
        await env.SUBSCRIBERS.put('meta:lastWelcomeRun', JSON.stringify({
          at: new Date().toISOString(), subscribers: keys.length, due: due.length, sent, marked, lastResendError,
        }));
      } catch (e) { /* non-fatal */ }
    }

    return json({ success: true, subscribers: keys.length, due: due.length, sent, marked, lastResendError });
  } catch (err) {
    return json({ error: 'welcome-series crashed', detail: String((err && err.message) || err) }, 200);
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
