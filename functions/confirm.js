// functions/confirm.js
// Cloudflare Pages Function — double opt-in confirmation.
//
// The confirmation email (functions/subscribe.js) links here:
//   https://promptai.in/confirm?email=someone@example.com&token=…
//
// On a valid token this:
//   1. promotes the address from  pending:<email>  to an active subscriber,
//   2. sends the first briefing immediately (same content as the digest),
//   3. shows a friendly confirmation page.
//
// Invalid / expired tokens get a polite page with a re-subscribe pointer.
// Uses the same SUBSCRIBERS KV binding + Resend config as subscribe.js.

import { fetchDigestContent, digestHtml, digestText } from './send-digest.js';
import { unsubscribeUrl } from './lib/feedlib.js';

export async function onRequest(context) {
  const { request, env } = context;
  const url = new URL(request.url);
  const email = (url.searchParams.get('email') || '').trim().toLowerCase();
  const token = (url.searchParams.get('token') || '').trim();

  const valid = /^[^\s@]+@[^\s@]+\.[^\s@]+$/.test(email) && token;

  if (!env.SUBSCRIBERS) {
    return htmlPage('Almost there', 'The subscription backend isn’t configured yet — please try again later.', false);
  }

  if (!valid) {
    return htmlPage('Invalid link', 'This confirmation link is missing or malformed. Head back to the site and subscribe again — it takes ten seconds.', false);
  }

  try {
    // Already active? (clicked the link twice)
    const active = await env.SUBSCRIBERS.get(email);
    if (active) {
      return htmlPage("You're all set", `<b>${escapeHtml(email)}</b> is already confirmed. Your briefing arrives every Tuesday.`, true);
    }

    const rawPending = await env.SUBSCRIBERS.get('pending:' + email);
    if (!rawPending) {
      return htmlPage('Link expired', 'This confirmation link has expired (they last 7 days). Subscribe again on the site and we’ll send a fresh one.', false);
    }
    let pending = {};
    try { pending = JSON.parse(rawPending); } catch (e) {}
    if (!pending.token || pending.token !== token) {
      return htmlPage('Invalid link', 'This confirmation link doesn’t match our records. Subscribe again on the site and use the newest email.', false);
    }

    // ── Activate ──
    await env.SUBSCRIBERS.put(email, JSON.stringify({
      email,
      subscribedAt: pending.at || new Date().toISOString(),
      confirmedAt: new Date().toISOString(),
      source: 'promptai.in (double opt-in)',
    }));
    await env.SUBSCRIBERS.delete('pending:' + email);

    // ── Send the first briefing (best effort — never blocks the page) ──
    let firstSent = false;
    if (env.RESEND_API_KEY && env.FROM_EMAIL) {
      try {
        const content = await fetchDigestContent();
        const hasContent = content.news.length + content.blogs.length > 0 || content.paper;
        if (hasContent) {
          const dateStr = new Date().toLocaleString('en-US', {
            month: 'short', day: 'numeric', hour: 'numeric', minute: '2-digit',
          });
          const unsub = await unsubscribeUrl(env, email);
          const issueDate = new Date().toISOString().slice(0, 10);
          const resp = await fetch('https://api.resend.com/emails', {
            method: 'POST',
            headers: { 'Authorization': 'Bearer ' + env.RESEND_API_KEY, 'Content-Type': 'application/json' },
            body: JSON.stringify({
              from: env.FROM_EMAIL,
              to: [email],
              subject: `✅ You're in — your first PromptAI briefing`,
              html: digestHtml({ ...content, dateStr, email, unsubUrl: unsub, issueDate }),
              text: digestText({ ...content, dateStr, email, unsubUrl: unsub, issueDate }),
              headers: {
                'List-Unsubscribe': '<' + unsub + '>',
                'List-Unsubscribe-Post': 'List-Unsubscribe=One-Click',
              },
            }),
          });
          firstSent = resp.ok;
        }
      } catch (e) { /* page still confirms; digest arrives Tuesday */ }
    }

    return htmlPage(
      "You're subscribed 🎉",
      `<b>${escapeHtml(email)}</b> is confirmed.` +
      (firstSent
        ? ' Your first briefing is on its way to your inbox right now — then every Tuesday.'
        : ' Your first briefing arrives on Tuesday.'),
      true
    );
  } catch (err) {
    return htmlPage('Something went wrong', 'We couldn’t confirm your subscription just now. Please try the link again in a minute.', false);
  }
}

function escapeHtml(s) {
  return (s || '').replace(/&/g, '&amp;').replace(/</g, '&lt;').replace(/>/g, '&gt;').replace(/"/g, '&quot;');
}

function htmlPage(title, msg, ok) {
  const body = `<!DOCTYPE html><html lang="en"><head>
<meta charset="UTF-8"/><meta name="viewport" content="width=device-width, initial-scale=1.0"/>
<title>${escapeHtml(title)} — PromptAI</title>
<meta name="robots" content="noindex"/>
<link rel="preconnect" href="https://fonts.googleapis.com"/>
<link href="https://fonts.googleapis.com/css2?family=Roboto+Serif:opsz,wght@8..144,600&family=Roboto:wght@400;500&display=swap" rel="stylesheet"/>
<style>
  *{box-sizing:border-box;margin:0;padding:0}
  body{font-family:'Roboto',system-ui,sans-serif;background:#eef2f7;color:#0f172a;min-height:100vh;display:flex;align-items:center;justify-content:center;padding:24px}
  .card{background:#fff;max-width:480px;width:100%;border-radius:16px;overflow:hidden;box-shadow:0 12px 40px rgba(10,22,40,.12)}
  .top{background:#0a1628;padding:22px 32px;font-family:'Roboto Serif',Georgia,serif;font-size:22px;font-weight:600;color:#fff;display:flex;align-items:center;gap:9px}
  .dot{width:10px;height:10px;border-radius:50%;background:#2563eb;display:inline-block}
  .body{padding:34px 32px 36px}
  h1{font-family:'Roboto Serif',Georgia,serif;font-size:26px;line-height:1.25;margin-bottom:12px}
  p{font-size:16px;line-height:1.65;color:#475569}
  .btn{display:inline-block;margin-top:24px;padding:12px 26px;background:#2563eb;color:#fff;border-radius:10px;font-weight:600;font-size:15px;text-decoration:none}
</style></head>
<body><div class="card">
  <div class="top"><span class="dot"></span> PromptAI</div>
  <div class="body">
    <h1>${escapeHtml(title)}</h1>
    <p>${msg}</p>
    <a class="btn" href="https://promptai.in">${ok ? 'Read today’s briefing →' : '← Back to PromptAI'}</a>
  </div>
</div></body></html>`;
  return new Response(body, {
    status: 200,
    headers: { 'Content-Type': 'text/html; charset=utf-8', 'Cache-Control': 'no-store' },
  });
}
