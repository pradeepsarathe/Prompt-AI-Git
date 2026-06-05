// functions/subscribe.js
// Cloudflare Pages Function — Newsletter subscribe endpoint
// Stores emails in Cloudflare KV (namespace binding: SUBSCRIBERS) and sends the
// new subscriber an immediate confirmation briefing (5 news + 5 blogs + 1 paper)
// via Resend.
// Setup: Pages → Settings → Functions → KV namespace bindings → add SUBSCRIBERS

import { fetchDigestContent, digestHtml } from './send-digest.js';

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

  if (request.method !== 'POST') {
    return new Response(JSON.stringify({ error: 'Method not allowed' }), {
      status: 405,
      headers: { 'Content-Type': 'application/json', 'Access-Control-Allow-Origin': '*' },
    });
  }

  try {
    let email = '';
    const contentType = request.headers.get('content-type') || '';

    if (contentType.includes('application/json')) {
      const body = await request.json();
      email = body.email || '';
    } else {
      const body = await request.text();
      const params = new URLSearchParams(body);
      email = params.get('email') || '';
    }

    email = email.trim().toLowerCase();

    // Validate
    if (!email || !/^[^\s@]+@[^\s@]+\.[^\s@]+$/.test(email)) {
      return new Response(JSON.stringify({ error: 'Invalid email address' }), {
        status: 400,
        headers: { 'Content-Type': 'application/json', 'Access-Control-Allow-Origin': '*' },
      });
    }

    // Store in KV if binding exists
    let isNew = false;
    if (env.SUBSCRIBERS) {
      const existing = await env.SUBSCRIBERS.get(email);
      if (!existing) {
        isNew = true;
        await env.SUBSCRIBERS.put(email, JSON.stringify({
          email,
          subscribedAt: new Date().toISOString(),
          source: 'promptai.in',
        }));
      }
    }

    // Send the latest-blogs email (Resend). Only for new subscribers, only if
    // RESEND_API_KEY + FROM_EMAIL are configured. Never blocks the response.
    if (isNew && env.RESEND_API_KEY && env.FROM_EMAIL) {
      try {
        const content = await fetchDigestContent(); // { news, blogs, paper }
        const hasContent = content.news.length + content.blogs.length > 0 || content.paper;
        const dateStr = new Date().toLocaleString('en-US', {
          month: 'short', day: 'numeric', hour: 'numeric', minute: '2-digit',
        });
        const html = hasContent
          ? digestHtml({ ...content, dateStr, email })
          : welcomeHtml(email); // fallback if feeds are temporarily empty
        await fetch('https://api.resend.com/emails', {
          method: 'POST',
          headers: {
            'Authorization': 'Bearer ' + env.RESEND_API_KEY,
            'Content-Type': 'application/json',
          },
          body: JSON.stringify({
            from: env.FROM_EMAIL,                 // e.g. "PromptAI <briefing@promptai.in>"
            to: [email],
            subject: hasContent
              ? `✅ You're subscribed — your first PromptAI briefing inside`
              : `Welcome to PromptAI 🎉`,
            html,
          }),
        });
      } catch (e) { /* non-fatal — subscription already saved */ }
    }

    // Always succeed — graceful fallback even without KV
    return new Response(JSON.stringify({ success: true, message: 'Subscribed!', isNew }), {
      status: 200,
      headers: { 'Content-Type': 'application/json', 'Access-Control-Allow-Origin': '*' },
    });

  } catch (err) {
    return new Response(JSON.stringify({ error: 'Server error', detail: err.message }), {
      status: 500,
      headers: { 'Content-Type': 'application/json', 'Access-Control-Allow-Origin': '*' },
    });
  }
}

// Branded welcome email (mirrors emails/welcome.html, inlined for the runtime).
function welcomeHtml(email) {
  const unsub = 'https://promptai.in/unsubscribe?email=' + encodeURIComponent(email);
  return `<!DOCTYPE html><html><body style="margin:0;padding:0;background:#eef2f7;">
  <table role="presentation" width="100%" cellpadding="0" cellspacing="0" style="background:#eef2f7;"><tr><td align="center" style="padding:32px 16px;">
  <table role="presentation" width="600" cellpadding="0" cellspacing="0" style="width:600px;max-width:600px;background:#fff;border-radius:16px;overflow:hidden;">
    <tr><td style="background:#0a1628;padding:30px 40px;font-family:Georgia,serif;font-size:22px;font-weight:bold;color:#fff;">
      <span style="display:inline-block;width:10px;height:10px;background:#2563eb;border-radius:50%;margin-right:9px;vertical-align:middle;"></span>PromptAI</td></tr>
    <tr><td style="padding:44px 40px 8px;font-family:Helvetica,Arial,sans-serif;">
      <div style="font-size:12px;font-weight:bold;letter-spacing:1.5px;text-transform:uppercase;color:#2563eb;">Welcome aboard</div>
      <h1 style="margin:14px 0 0;font-family:Georgia,serif;font-size:32px;line-height:1.2;color:#0a1628;font-weight:normal;">You're in. Smarter AI starts Tuesday.</h1></td></tr>
    <tr><td style="padding:20px 40px 8px;font-family:Helvetica,Arial,sans-serif;font-size:16px;line-height:1.7;color:#475569;">
      <p style="margin:0 0 16px;">Thanks for subscribing. Every week we read the firehose — arXiv, Hacker News, the best ML blogs — so you don't have to, and send only what matters.</p>
      <p style="margin:0 0 6px;font-weight:bold;color:#0a1628;">Every Tuesday you'll get:</p>
      <ul style="margin:0 0 4px;padding-left:20px;color:#475569;">
        <li style="margin:6px 0;"><b>3 must-read papers</b> — summarized in plain English.</li>
        <li style="margin:6px 0;"><b>The headlines that count</b> — launches, funding, shifts. No hype.</li>
        <li style="margin:6px 0;"><b>One deep dive</b> — a hand-picked explainer for the weekend.</li>
      </ul></td></tr>
    <tr><td align="center" style="padding:24px 40px 36px;">
      <a href="https://promptai.in" style="display:inline-block;padding:15px 34px;background:#2563eb;border-radius:10px;font-family:Helvetica,Arial,sans-serif;font-size:15px;font-weight:bold;color:#fff;text-decoration:none;">Read today's feed →</a></td></tr>
    <tr><td style="background:#f8fafc;border-top:1px solid #e2e8f0;padding:26px 40px;font-family:Helvetica,Arial,sans-serif;font-size:12px;line-height:1.7;color:#94a3b8;text-align:center;">
      You're receiving this because you subscribed at promptai.in.<br/>
      <a href="${unsub}" style="color:#2563eb;">Unsubscribe</a> · <a href="https://promptai.in" style="color:#2563eb;">Visit site</a></td></tr>
  </table></td></tr></table></body></html>`;
}
