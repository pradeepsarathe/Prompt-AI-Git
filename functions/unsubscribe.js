// functions/unsubscribe.js
// Cloudflare Pages Function — one-click unsubscribe.
//
// Every digest/confirmation email links here:
//   https://promptai.in/unsubscribe?email=someone@example.com
// This removes the address from the SUBSCRIBERS KV namespace so the hourly
// send (send-digest.js) skips them, and shows a friendly confirmation page.
//
// Uses the same SUBSCRIBERS KV binding the subscribe endpoint writes to.

export async function onRequest(context) {
  const { request, env } = context;
  const url = new URL(request.url);
  const email = (url.searchParams.get('email') || '').trim().toLowerCase();

  const valid = /^[^\s@]+@[^\s@]+\.[^\s@]+$/.test(email);
  let removed = false;

  if (valid && env.SUBSCRIBERS) {
    try {
      const existing = await env.SUBSCRIBERS.get(email);
      if (existing) { await env.SUBSCRIBERS.delete(email); removed = true; }
    } catch (e) { /* fall through to page */ }
  }

  const title = !valid
    ? 'Invalid link'
    : removed
      ? "You're unsubscribed"
      : "You're already unsubscribed";
  const msg = !valid
    ? 'This unsubscribe link is missing or malformed. If you keep getting emails, reply to one and we’ll remove you.'
    : removed
      ? `<b>${escapeHtml(email)}</b> has been removed. You won’t receive any more PromptAI emails. Sorry to see you go.`
      : `<b>${escapeHtml(email)}</b> isn’t on our list — you’re all set, no more emails will be sent.`;

  return new Response(page(title, msg, valid && email), {
    status: 200,
    headers: { 'Content-Type': 'text/html; charset=utf-8', 'Cache-Control': 'no-store' },
  });
}

function escapeHtml(s) {
  return (s || '').replace(/&/g, '&amp;').replace(/</g, '&lt;').replace(/>/g, '&gt;').replace(/"/g, '&quot;');
}

function page(title, msg, email) {
  const resub = email
    ? `<p style="margin:22px 0 0;font-size:14px;color:#64748b;">Changed your mind?
         <a href="https://promptai.in/#newsletter" style="color:#2563eb;font-weight:600;text-decoration:none;">Re-subscribe</a></p>`
    : '';
  return `<!DOCTYPE html><html lang="en"><head>
<meta charset="UTF-8"/><meta name="viewport" content="width=device-width, initial-scale=1.0"/>
<title>${title} — PromptAI</title>
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
    ${resub}
    <a class="btn" href="https://promptai.in">← Back to PromptAI</a>
  </div>
</div></body></html>`;
}
