// functions/unsubscribe.js
// Cloudflare Pages Function — unsubscribe with HMAC-signed links (R17).
//
// Every email now links:  /unsubscribe?email=<addr>&sig=<hmac>
// The sig is an HMAC-SHA256 of the email (secret: UNSUB_SECRET or
// CRON_SECRET), so strangers can no longer unsubscribe arbitrary
// addresses with a guessable URL.
//
//   • GET/POST with a VALID sig   → removed instantly (true one-click;
//     also satisfies Gmail/Yahoo List-Unsubscribe-Post).
//   • GET without / with bad sig  → shows a "confirm unsubscribe" page;
//     the button POSTs back here (legacy links keep working, but it now
//     takes a human click).
//   • POST confirm=1 (the form)   → removed.
//
// Uses the same SUBSCRIBERS KV binding the subscribe endpoint writes to.

import { hmacVerify } from './lib/feedlib.js';

export async function onRequest(context) {
  const { request, env } = context;
  const url = new URL(request.url);

  let email = (url.searchParams.get('email') || '').trim().toLowerCase();
  let sig = url.searchParams.get('sig') || '';
  let confirmed = false;

  if (request.method === 'POST') {
    const ct = request.headers.get('content-type') || '';
    try {
      if (ct.includes('application/x-www-form-urlencoded') || ct.includes('multipart/form-data')) {
        const form = await request.formData();
        email = (String(form.get('email') || email)).trim().toLowerCase();
        if (form.get('confirm')) confirmed = true;
        // RFC 8058 one-click POSTs "List-Unsubscribe=One-Click" — the sig in
        // the URL still authorizes it.
        if (form.get('List-Unsubscribe')) confirmed = false;
      }
    } catch (e) { /* fall through */ }
  }

  const valid = /^[^\s@]+@[^\s@]+\.[^\s@]+$/.test(email);
  const secret = env.UNSUB_SECRET || env.CRON_SECRET || '';
  const signed = valid && secret && await hmacVerify(secret, email, sig);

  // No secret configured at all → behave like the legacy endpoint (but
  // still require the confirm click for GETs).
  const authorized = signed || confirmed || (request.method === 'POST' && !secret);

  let removed = false;
  let existed = false;
  if (valid && authorized && env.SUBSCRIBERS) {
    try {
      const existing = await env.SUBSCRIBERS.get(email);
      existed = !!existing;
      if (existing) { await env.SUBSCRIBERS.delete(email); removed = true; }
      // also clear any pending double-opt-in record
      await env.SUBSCRIBERS.delete('pending:' + email).catch?.(() => {});
    } catch (e) { /* fall through to page */ }
  }

  // ── render ──
  if (!valid) {
    return page('Invalid link',
      'This unsubscribe link is missing or malformed. If you keep getting emails, reply to one and we’ll remove you.', '');
  }

  if (!authorized) {
    // Legacy/unsigned link: ask for one click.
    return page('Confirm unsubscribe',
      `Click below to stop PromptAI emails to <b>${escapeHtml(email)}</b>.`,
      email,
      `<form method="POST" action="/unsubscribe" style="margin-top:24px;">
         <input type="hidden" name="email" value="${escapeHtml(email)}"/>
         <input type="hidden" name="confirm" value="1"/>
         <button type="submit" style="padding:13px 28px;background:#dc2626;color:#fff;border:none;border-radius:10px;font-weight:600;font-size:15px;cursor:pointer;font-family:inherit;">Unsubscribe ${escapeHtml(email)}</button>
       </form>`);
  }

  const title = removed ? "You're unsubscribed" : "You're already unsubscribed";
  const msg = removed
    ? `<b>${escapeHtml(email)}</b> has been removed. You won’t receive any more PromptAI emails. Sorry to see you go.`
    : `<b>${escapeHtml(email)}</b> isn’t on our list — you’re all set, no more emails will be sent.`;
  return page(title, msg, email);
}

function escapeHtml(s) {
  return (s || '').replace(/&/g, '&amp;').replace(/</g, '&lt;').replace(/>/g, '&gt;').replace(/"/g, '&quot;');
}

function page(title, msg, email, extraHtml) {
  const resub = email
    ? `<p style="margin:22px 0 0;font-size:14px;color:#64748b;">Changed your mind?
         <a href="https://promptai.in/#newsletter" style="color:#2563eb;font-weight:600;text-decoration:none;">Re-subscribe</a></p>`
    : '';
  const html = `<!DOCTYPE html><html lang="en"><head>
<meta charset="UTF-8"/><meta name="viewport" content="width=device-width, initial-scale=1.0"/>
<title>${title} — PromptAI</title>
<meta name="robots" content="noindex"/>
<link rel="preconnect" href="https://fonts.googleapis.com"/>
<link href="https://fonts.googleapis.com/css2?family=DM+Serif+Display&family=DM+Sans:wght@400;500;600&display=swap" rel="stylesheet"/>
<style>
  *{box-sizing:border-box;margin:0;padding:0}
  body{font-family:'DM Sans',system-ui,sans-serif;background:#eef2f7;color:#0f172a;min-height:100vh;display:flex;align-items:center;justify-content:center;padding:24px}
  .card{background:#fff;max-width:480px;width:100%;border-radius:16px;overflow:hidden;box-shadow:0 12px 40px rgba(10,22,40,.12)}
  .top{background:#0a1628;padding:22px 32px;font-family:'DM Serif Display',serif;font-size:22px;color:#fff;display:flex;align-items:center;gap:9px}
  .dot{width:10px;height:10px;border-radius:50%;background:#2563eb;display:inline-block}
  .body{padding:34px 32px 36px}
  h1{font-family:'DM Serif Display',serif;font-size:26px;line-height:1.2;margin-bottom:12px}
  p{font-size:16px;line-height:1.65;color:#475569}
  .btn{display:inline-block;margin-top:24px;padding:12px 26px;background:#2563eb;color:#fff;border-radius:10px;font-weight:600;font-size:15px;text-decoration:none}
</style></head>
<body><div class="card">
  <div class="top"><span class="dot"></span> PromptAI</div>
  <div class="body">
    <h1>${title}</h1>
    <p>${msg}</p>
    ${extraHtml || ''}
    ${resub}
    <a class="btn" href="https://promptai.in">← Back to PromptAI</a>
  </div>
</div></body></html>`;
  return new Response(html, {
    status: 200,
    headers: { 'Content-Type': 'text/html; charset=utf-8', 'Cache-Control': 'no-store' },
  });
}
