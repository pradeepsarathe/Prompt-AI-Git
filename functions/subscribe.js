// functions/subscribe.js
// Cloudflare Pages Function — Newsletter subscribe endpoint (double opt-in).
//
// June 2026: switched from "add + send briefing immediately" to DOUBLE OPT-IN:
//   1. POST /subscribe { email } → stores a pending record + emails a
//      confirmation link (protects sender reputation: typos, bots and
//      prank entries never reach the real list — and it's the consent
//      model GDPR/DPDP expect).
//   2. The link hits /confirm?email=…&token=… (functions/confirm.js) which
//      activates the address and sends the first briefing.
//
// Existing subscribers (stored before double opt-in) are grandfathered as
// active — nothing changes for them.
//
// KV layout (SUBSCRIBERS binding):
//   <email>            → active subscriber  { email, subscribedAt, source, confirmedAt? }
//   pending:<email>    → { token, at }      (TTL 7 days)
//   rl:<ip>            → signup rate-limit counters
//   meta:*             → operational bookkeeping (never emailed)
//
// Setup: Pages → Settings → Functions → KV namespace bindings → SUBSCRIBERS

import { fetchDigestContent, digestHtml, digestText } from './send-digest.js';

const PENDING_TTL = 60 * 60 * 24 * 7; // unconfirmed signups expire after 7 days

const json = (obj, status = 200) =>
  new Response(JSON.stringify(obj), {
    status,
    headers: { 'Content-Type': 'application/json', 'Access-Control-Allow-Origin': '*' },
  });

export async function onRequest(context) {
  const { request, env } = context;

  // CORS preflight
  if (request.method === 'OPTIONS') {
    return new Response(null, {
      headers: {
        'Access-Control-Allow-Origin': '*',
        'Access-Control-Allow-Methods': 'POST, OPTIONS',
        'Access-Control-Allow-Headers': 'Content-Type',
      },
    });
  }

  if (request.method !== 'POST') return json({ error: 'Method not allowed' }, 405);

  try {
    let email = '';
    let honeypot = '';
    const contentType = request.headers.get('content-type') || '';

    if (contentType.includes('application/json')) {
      const body = await request.json();
      email = body.email || '';
      honeypot = body.website || '';
    } else {
      const body = await request.text();
      const params = new URLSearchParams(body);
      email = params.get('email') || '';
      honeypot = params.get('website') || '';
    }

    // ── Honeypot: real users never fill the hidden "website" field. If it's
    // populated, silently pretend success so the bot gets no signal. ──
    if (honeypot.trim()) return json({ success: true, message: 'Subscribed!' });

    email = email.trim().toLowerCase();

    // Validate
    if (!email || !/^[^\s@]+@[^\s@]+\.[^\s@]+$/.test(email)) {
      return json({ error: 'Invalid email address' }, 400);
    }

    // ── Rate limiting: max 5 signups per IP per hour (KV-backed). ──
    if (env.SUBSCRIBERS) {
      const ip = request.headers.get('CF-Connecting-IP')
        || request.headers.get('X-Forwarded-For') || 'unknown';
      const rlKey = 'rl:' + ip;
      try {
        const count = parseInt(await env.SUBSCRIBERS.get(rlKey) || '0', 10);
        if (count >= 5) {
          return new Response(JSON.stringify({ error: 'Too many requests — please try again later.' }), {
            status: 429,
            headers: { 'Content-Type': 'application/json', 'Access-Control-Allow-Origin': '*', 'Retry-After': '3600' },
          });
        }
        await env.SUBSCRIBERS.put(rlKey, String(count + 1), { expirationTtl: 3600 });
      } catch (e) { /* fail open */ }
    }

    const canEmail = !!(env.RESEND_API_KEY && env.FROM_EMAIL);

    // ── No KV configured → legacy behavior: just send the briefing once ──
    if (!env.SUBSCRIBERS) {
      let emailSent = false, emailError = null;
      if (canEmail) {
        const r = await sendFirstBriefing(env, email);
        emailSent = r.sent; emailError = r.error;
      }
      return json({ success: true, message: 'Subscribed!', emailSent, emailError });
    }

    // ── Already an ACTIVE subscriber → nothing to do ──
    const active = await env.SUBSCRIBERS.get(email);
    if (active) {
      return json({ success: true, alreadySubscribed: true,
        message: 'You’re already subscribed — see you Tuesday!' });
    }

    // ── Pending or new → (re)issue the confirmation link ──
    let token = '';
    try {
      const rawPending = await env.SUBSCRIBERS.get('pending:' + email);
      if (rawPending) token = (JSON.parse(rawPending).token || '');
    } catch (e) {}
    if (!token) token = crypto.randomUUID().replace(/-/g, '');
    await env.SUBSCRIBERS.put('pending:' + email,
      JSON.stringify({ token, at: new Date().toISOString() }),
      { expirationTtl: PENDING_TTL });

    let emailSent = false;
    let emailError = null;
    if (canEmail) {
      const confirmUrl = 'https://promptai.in/confirm?email=' + encodeURIComponent(email) + '&token=' + token;
      try {
        const resp = await fetch('https://api.resend.com/emails', {
          method: 'POST',
          headers: { 'Authorization': 'Bearer ' + env.RESEND_API_KEY, 'Content-Type': 'application/json' },
          body: JSON.stringify({
            from: env.FROM_EMAIL,
            to: [email],
            subject: 'Confirm your PromptAI subscription',
            html: confirmHtml(confirmUrl),
            text: confirmText(confirmUrl),
          }),
        });
        if (resp.ok) emailSent = true;
        else emailError = (await resp.text()).slice(0, 300);
      } catch (e) { emailError = e.message; }
    } else {
      emailError = 'RESEND_API_KEY / FROM_EMAIL not configured';
    }

    return json({ success: true, pending: true, emailSent, emailError,
      message: 'Almost done — check your inbox to confirm.' });

  } catch (err) {
    return json({ error: 'Server error', detail: err.message }, 500);
  }
}

// Used only on the no-KV legacy path; /confirm sends the briefing normally.
async function sendFirstBriefing(env, email) {
  try {
    const content = await fetchDigestContent();
    const hasContent = content.news.length + content.blogs.length > 0 || content.paper;
    if (!hasContent) return { sent: false, error: 'No content available' };
    const dateStr = new Date().toLocaleString('en-US', {
      month: 'short', day: 'numeric', hour: 'numeric', minute: '2-digit',
    });
    const unsub = 'https://promptai.in/unsubscribe?email=' + encodeURIComponent(email);
    const resp = await fetch('https://api.resend.com/emails', {
      method: 'POST',
      headers: { 'Authorization': 'Bearer ' + env.RESEND_API_KEY, 'Content-Type': 'application/json' },
      body: JSON.stringify({
        from: env.FROM_EMAIL,
        to: [email],
        subject: `✅ You're subscribed — your PromptAI briefing inside`,
        html: digestHtml({ ...content, dateStr, email }),
        text: digestText({ ...content, dateStr, email }),
        headers: {
          'List-Unsubscribe': '<' + unsub + '>',
          'List-Unsubscribe-Post': 'List-Unsubscribe=One-Click',
        },
      }),
    });
    if (resp.ok) return { sent: true, error: null };
    return { sent: false, error: (await resp.text()).slice(0, 300) };
  } catch (e) { return { sent: false, error: e.message }; }
}

// ── confirmation email (light briefing brand) ────────────────────────
function confirmHtml(confirmUrl) {
  return `<!DOCTYPE html><html><body style="margin:0;padding:0;background:#eef2f7;">
  <table role="presentation" width="100%" cellpadding="0" cellspacing="0" style="background:#eef2f7;"><tr><td align="center" style="padding:32px 16px;">
  <table role="presentation" width="600" cellpadding="0" cellspacing="0" style="width:600px;max-width:600px;background:#fff;border-radius:16px;overflow:hidden;">
    <tr><td style="background:#0a1628;padding:26px 40px;font-family:Georgia,serif;font-size:22px;font-weight:bold;color:#fff;">
      <span style="display:inline-block;width:10px;height:10px;background:#2563eb;border-radius:50%;margin-right:9px;vertical-align:middle;"></span>PromptAI</td></tr>
    <tr><td style="padding:40px 40px 8px;font-family:Helvetica,Arial,sans-serif;">
      <div style="font-size:12px;font-weight:bold;letter-spacing:1.5px;text-transform:uppercase;color:#2563eb;">One last step</div>
      <h1 style="margin:12px 0 0;font-family:Georgia,serif;font-size:30px;line-height:1.2;color:#0a1628;font-weight:normal;">Confirm your subscription</h1></td></tr>
    <tr><td style="padding:18px 40px 6px;font-family:Helvetica,Arial,sans-serif;font-size:16px;line-height:1.7;color:#475569;">
      <p style="margin:0 0 14px;">Tap the button below and your first PromptAI briefing — the one story that matters, 5 headlines and the paper everyone's citing — lands right away. Then every Tuesday after that.</p></td></tr>
    <tr><td align="center" style="padding:16px 40px 32px;">
      <a href="${confirmUrl}" style="display:inline-block;padding:15px 36px;background:#2563eb;border-radius:10px;font-family:Helvetica,Arial,sans-serif;font-size:15px;font-weight:bold;color:#fff;text-decoration:none;">Confirm &amp; get my first briefing →</a></td></tr>
    <tr><td style="background:#f8fafc;border-top:1px solid #e2e8f0;padding:24px 40px;font-family:Helvetica,Arial,sans-serif;font-size:12px;line-height:1.7;color:#94a3b8;text-align:center;">
      Didn’t sign up at promptai.in? Ignore this email and you won’t be subscribed.<br/>
      The link expires in 7 days.</td></tr>
  </table></td></tr></table></body></html>`;
}

function confirmText(confirmUrl) {
  return [
    'PROMPTAI — CONFIRM YOUR SUBSCRIPTION',
    '====================================',
    '',
    'One last step: confirm your email and your first PromptAI briefing',
    'lands right away — then every Tuesday after that.',
    '',
    'Confirm: ' + confirmUrl,
    '',
    'Didn\u2019t sign up at promptai.in? Ignore this email and you won\u2019t be subscribed.',
    'The link expires in 7 days.',
  ].join('\n');
}
