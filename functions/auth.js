// functions/auth.js
// Cloudflare Pages Function — Cross-device account auth for PromptAI
// Stores users + sessions in Cloudflare KV so login works on EVERY device.
//
// Setup (one time):
//   Cloudflare Pages → Settings → Functions → KV namespace bindings
//   → add a binding named   USERS   pointing at a KV namespace.
//   (Optional, for password reset emails: RESEND_API_KEY + FROM_EMAIL —
//    the same ones the newsletter already uses.)
//
// Endpoints (all POST JSON to /auth with an "action" field):
//   { action:'signup',  email, password, name }  → { token, user }
//   { action:'login',   email, password }        → { token, user }
//   { action:'session', token }                  → { user }
//   { action:'logout',  token }                  → { success:true }
//   { action:'getdata', token }                  → { data }
//   { action:'setdata', token, data }            → { success:true }
//   { action:'reset-request', email }            → { success:true } (always)
//   { action:'reset-confirm', token, password }  → { token, user }
//   { action:'delete-account', token, password } → { success:true }
//
// Security (June 2026 hardening):
//   • KV-backed rate limiting per IP + per-account login lockout.
//   • PBKDF2-SHA256 at 600k iterations for new hashes (OWASP guidance);
//     legacy 100k hashes are upgraded transparently on successful login.
//   • CORS restricted to promptai.in / *.pages.dev previews (was "*").
//   • Email-based password reset (30-minute single-use token via Resend).
//
// If the USERS binding is missing, returns 503 so the client falls back to
// local-only mode gracefully (good for previews / first deploy).

const SESSION_TTL = 60 * 60 * 24 * 90; // 90 days
const RESET_TTL = 60 * 30;             // reset links live 30 minutes
const PBKDF2_ITER = 600000;            // new hashes (legacy users have 100000)
const LEGACY_ITER = 100000;

// ── CORS: only our own origins may call this endpoint ──
function corsOrigin(request) {
  const o = request.headers.get('Origin') || '';
  if (/^https:\/\/(www\.)?promptai\.in$/.test(o)) return o;
  if (/^https:\/\/[\w-]+\.pages\.dev$/.test(o)) return o;       // CF preview deploys
  if (/^http:\/\/localhost(:\d+)?$/.test(o)) return o;          // local dev
  return 'https://promptai.in';
}

const mkJson = (origin) => (obj, status = 200) =>
  new Response(JSON.stringify(obj), {
    status,
    headers: {
      'Content-Type': 'application/json',
      'Access-Control-Allow-Origin': origin,
      'Access-Control-Allow-Methods': 'POST, OPTIONS',
      'Access-Control-Allow-Headers': 'Content-Type',
      'Vary': 'Origin',
      'Cache-Control': 'no-store',
    },
  });

// ── crypto helpers (PBKDF2-SHA256, salted) ──────────────
const enc = new TextEncoder();
const toHex = (buf) =>
  [...new Uint8Array(buf)].map((b) => b.toString(16).padStart(2, '0')).join('');
const fromHex = (hex) =>
  new Uint8Array(hex.match(/.{1,2}/g).map((b) => parseInt(b, 16)));

async function hashPassword(password, saltHex, iterations) {
  const salt = saltHex ? fromHex(saltHex) : crypto.getRandomValues(new Uint8Array(16));
  const iter = iterations || PBKDF2_ITER;
  const key = await crypto.subtle.importKey('raw', enc.encode(password), 'PBKDF2', false, ['deriveBits']);
  const bits = await crypto.subtle.deriveBits(
    { name: 'PBKDF2', salt, iterations: iter, hash: 'SHA-256' },
    key,
    256
  );
  return { salt: toHex(salt), hash: toHex(bits), iter };
}

// constant-time-ish compare
function safeEqual(a, b) {
  if (a.length !== b.length) return false;
  let out = 0;
  for (let i = 0; i < a.length; i++) out |= a.charCodeAt(i) ^ b.charCodeAt(i);
  return out === 0;
}

const validEmail = (e) => /^[^\s@]+@[^\s@]+\.[^\s@]+$/.test(e);

// ── KV rate limiting helpers ─────────────────────────────
// bump(key, max, ttl) → true when the caller is OVER the limit.
async function bump(kv, key, max, ttl) {
  try {
    const n = parseInt((await kv.get(key)) || '0', 10);
    if (n >= max) return true;
    await kv.put(key, String(n + 1), { expirationTtl: ttl });
  } catch (e) { /* fail open — never lock out real users on a KV blip */ }
  return false;
}
async function clearKey(kv, key) { try { await kv.delete(key); } catch (e) {} }

export async function onRequest(context) {
  const { request, env } = context;
  const json = mkJson(corsOrigin(request));

  if (request.method === 'OPTIONS') return json({}, 204);
  if (request.method !== 'POST') return json({ error: 'Method not allowed' }, 405);

  // No KV binding → tell client to use local fallback
  if (!env.USERS) return json({ error: 'Auth backend not configured', offline: true }, 503);

  let body;
  try {
    body = await request.json();
  } catch (e) {
    return json({ error: 'Invalid request' }, 400);
  }

  const action = body.action;
  const email = (body.email || '').trim().toLowerCase();
  const password = body.password || '';
  const name = (body.name || '').trim();
  const ip = request.headers.get('CF-Connecting-IP')
    || request.headers.get('X-Forwarded-For') || 'unknown';

  try {
    // ── global per-IP limit: 30 auth calls / 15 min ──────
    if (await bump(env.USERS, 'rl:ip:' + ip, 30, 900)) {
      return json({ error: 'Too many requests — please wait a few minutes and try again.' }, 429);
    }

    // ── SIGN UP ──────────────────────────────────────────
    if (action === 'signup') {
      if (await bump(env.USERS, 'rl:signup:' + ip, 5, 3600)) {
        return json({ error: 'Too many new accounts from this connection — try again later.' }, 429);
      }
      if (!validEmail(email)) return json({ error: 'Please enter a valid email address.' }, 400);
      if (password.length < 8) return json({ error: 'Password must be at least 8 characters.' }, 400);
      if (!name) return json({ error: 'Please enter your name.' }, 400);

      const existing = await env.USERS.get('user:' + email);
      if (existing) return json({ error: 'Account already exists with this email — sign in instead.' }, 409);

      const { salt, hash, iter } = await hashPassword(password);
      const user = { email, name, salt, hash, iter, joinedAt: new Date().toISOString() };
      await env.USERS.put('user:' + email, JSON.stringify(user));

      const token = await createSession(env, email);
      return json({ token, user: { email, name } });
    }

    // ── LOG IN ───────────────────────────────────────────
    if (action === 'login') {
      if (!validEmail(email)) return json({ error: 'Please enter a valid email address.' }, 400);

      // per-account lockout: 8 failed attempts / 15 min
      const lockKey = 'rl:login:' + email;
      const locked = parseInt((await env.USERS.get(lockKey)) || '0', 10) >= 8;
      if (locked) {
        return json({ error: 'Too many failed attempts. Wait 15 minutes or use “Forgot password”.' }, 429);
      }

      const raw = await env.USERS.get('user:' + email);
      if (!raw) {
        await bump(env.USERS, lockKey, 8, 900);
        return json({ error: 'Wrong email or password. New here? Create an account.' }, 401);
      }

      const user = JSON.parse(raw);
      const iterUsed = user.iter || LEGACY_ITER;
      const { hash } = await hashPassword(password, user.salt, iterUsed);
      if (!safeEqual(hash, user.hash)) {
        await bump(env.USERS, lockKey, 8, 900);
        return json({ error: 'Wrong email or password. New here? Create an account.' }, 401);
      }
      await clearKey(env.USERS, lockKey);

      // transparent hash upgrade: legacy 100k → 600k on successful login
      if (iterUsed < PBKDF2_ITER) {
        try {
          const up = await hashPassword(password); // fresh salt, new iter
          await env.USERS.put('user:' + email, JSON.stringify({
            ...user, salt: up.salt, hash: up.hash, iter: up.iter,
          }));
        } catch (e) { /* non-fatal — next login retries */ }
      }

      const token = await createSession(env, email);
      return json({ token, user: { email: user.email, name: user.name } });
    }

    // ── PASSWORD RESET — request ─────────────────────────
    // Always answers success so the endpoint can't be used to probe which
    // emails have accounts.
    if (action === 'reset-request') {
      if (!validEmail(email)) return json({ success: true });
      if (await bump(env.USERS, 'rl:reset:' + ip, 5, 3600)) return json({ success: true });

      const raw = await env.USERS.get('user:' + email);
      if (raw && env.RESEND_API_KEY && env.FROM_EMAIL) {
        const token = crypto.randomUUID() + crypto.randomUUID().replace(/-/g, '');
        await env.USERS.put('reset:' + token, email, { expirationTtl: RESET_TTL });
        const link = 'https://promptai.in/?reset=' + token;
        try {
          await fetch('https://api.resend.com/emails', {
            method: 'POST',
            headers: { 'Authorization': 'Bearer ' + env.RESEND_API_KEY, 'Content-Type': 'application/json' },
            body: JSON.stringify({
              from: env.FROM_EMAIL,
              to: [email],
              subject: 'Reset your PromptAI password',
              html: resetHtml(link),
              text: 'Reset your PromptAI password (link valid for 30 minutes):\n\n' + link +
                    '\n\nIf you didn\u2019t request this, you can safely ignore this email.',
            }),
          });
        } catch (e) { /* user can retry */ }
      }
      return json({ success: true });
    }

    // ── PASSWORD RESET — confirm ─────────────────────────
    if (action === 'reset-confirm') {
      const rtoken = (body.token || '').trim();
      if (!rtoken) return json({ error: 'Reset link is missing or malformed.' }, 400);
      if (password.length < 8) return json({ error: 'Password must be at least 8 characters.' }, 400);

      const resetEmail = await env.USERS.get('reset:' + rtoken);
      if (!resetEmail) return json({ error: 'This reset link has expired — request a new one.' }, 401);

      const raw = await env.USERS.get('user:' + resetEmail);
      if (!raw) return json({ error: 'Account no longer exists.' }, 404);

      const user = JSON.parse(raw);
      const up = await hashPassword(password);
      await env.USERS.put('user:' + resetEmail, JSON.stringify({
        ...user, salt: up.salt, hash: up.hash, iter: up.iter,
      }));
      await clearKey(env.USERS, 'reset:' + rtoken);   // single use
      await clearKey(env.USERS, 'rl:login:' + resetEmail);

      const token = await createSession(env, resetEmail);
      return json({ token, user: { email: user.email, name: user.name } });
    }

    // ── VALIDATE SESSION ─────────────────────────────────
    if (action === 'session') {
      const token = body.token || '';
      if (!token) return json({ error: 'No session' }, 401);
      const sessEmail = await env.USERS.get('session:' + token);
      if (!sessEmail) return json({ error: 'Session expired' }, 401);
      const raw = await env.USERS.get('user:' + sessEmail);
      if (!raw) return json({ error: 'Session expired' }, 401);
      const user = JSON.parse(raw);
      return json({ user: { email: user.email, name: user.name } });
    }

    // ── LOG OUT ──────────────────────────────────────────
    if (action === 'logout') {
      const token = body.token || '';
      if (token) await env.USERS.delete('session:' + token);
      return json({ success: true });
    }

    // ── GET USER DATA (saved / liked / history) ──────────
    if (action === 'getdata') {
      const email = await emailFromToken(env, body.token);
      if (!email) return json({ error: 'Session expired' }, 401);
      const raw = await env.USERS.get('data:' + email);
      return json({ data: raw ? JSON.parse(raw) : { saved: [], liked: [], history: [], learning: [] } });
    }

    // ── SAVE USER DATA ───────────────────────────────────
    if (action === 'setdata') {
      const email = await emailFromToken(env, body.token);
      if (!email) return json({ error: 'Session expired' }, 401);
      const data = body.data || { saved: [], liked: [], history: [], learning: [] };
      // basic shape guard + cap to keep values small
      const clean = {
        saved:    Array.isArray(data.saved)    ? data.saved.slice(0, 500)    : [],
        liked:    Array.isArray(data.liked)    ? data.liked.slice(0, 500)    : [],
        history:  Array.isArray(data.history)  ? data.history.slice(0, 200)  : [],
        learning: Array.isArray(data.learning) ? data.learning.slice(0, 200) : [],
      };
      await env.USERS.put('data:' + email, JSON.stringify(clean));
      return json({ success: true });
    }

    // ── DELETE ACCOUNT (privacy: right to erasure) ───────
    // Requires the current password so a stolen token alone can't destroy
    // an account.
    if (action === 'delete-account') {
      const email = await emailFromToken(env, body.token);
      if (!email) return json({ error: 'Session expired' }, 401);
      const raw = await env.USERS.get('user:' + email);
      if (!raw) return json({ error: 'Account not found' }, 404);
      const user = JSON.parse(raw);
      const { hash } = await hashPassword(password, user.salt, user.iter || LEGACY_ITER);
      if (!safeEqual(hash, user.hash)) return json({ error: 'Wrong password.' }, 401);
      await Promise.all([
        env.USERS.delete('user:' + email),
        env.USERS.delete('data:' + email),
        env.USERS.delete('session:' + body.token),
      ]);
      return json({ success: true });
    }

    return json({ error: 'Unknown action' }, 400);
  } catch (err) {
    return json({ error: 'Server error', detail: err.message }, 500);
  }
}

// Resolve a session token → email (or null)
async function emailFromToken(env, token) {
  if (!token) return null;
  return await env.USERS.get('session:' + token);
}

async function createSession(env, email) {
  const token = crypto.randomUUID() + crypto.randomUUID().replace(/-/g, '');
  await env.USERS.put('session:' + token, email, { expirationTtl: SESSION_TTL });
  return token;
}

// Branded password-reset email (matches the light briefing brand).
function resetHtml(link) {
  return `<!DOCTYPE html><html><body style="margin:0;padding:0;background:#eef2f7;">
  <table role="presentation" width="100%" cellpadding="0" cellspacing="0" style="background:#eef2f7;"><tr><td align="center" style="padding:32px 16px;">
  <table role="presentation" width="600" cellpadding="0" cellspacing="0" style="width:600px;max-width:600px;background:#fff;border-radius:16px;overflow:hidden;">
    <tr><td style="background:#0a1628;padding:26px 40px;font-family:Georgia,serif;font-size:22px;font-weight:bold;color:#fff;">
      <span style="display:inline-block;width:10px;height:10px;background:#2563eb;border-radius:50%;margin-right:9px;vertical-align:middle;"></span>PromptAI</td></tr>
    <tr><td style="padding:40px 40px 8px;font-family:Helvetica,Arial,sans-serif;">
      <h1 style="margin:0;font-family:Georgia,serif;font-size:28px;line-height:1.25;color:#0a1628;font-weight:normal;">Reset your password</h1></td></tr>
    <tr><td style="padding:18px 40px 8px;font-family:Helvetica,Arial,sans-serif;font-size:16px;line-height:1.7;color:#475569;">
      <p style="margin:0 0 14px;">Someone (hopefully you) asked to reset the password for this PromptAI account. The link below works once and expires in <b>30 minutes</b>.</p></td></tr>
    <tr><td align="center" style="padding:18px 40px 30px;">
      <a href="${link}" style="display:inline-block;padding:15px 34px;background:#2563eb;border-radius:10px;font-family:Helvetica,Arial,sans-serif;font-size:15px;font-weight:bold;color:#fff;text-decoration:none;">Choose a new password →</a></td></tr>
    <tr><td style="background:#f8fafc;border-top:1px solid #e2e8f0;padding:24px 40px;font-family:Helvetica,Arial,sans-serif;font-size:12px;line-height:1.7;color:#94a3b8;text-align:center;">
      Didn’t request this? You can safely ignore this email — your password is unchanged.</td></tr>
  </table></td></tr></table></body></html>`;
}
