// functions/auth.js
// Cloudflare Pages Function — Cross-device account auth for PromptAI
// Stores users + sessions in Cloudflare KV so login works on EVERY device.
//
// Setup (one time):
//   Cloudflare Pages → Settings → Functions → KV namespace bindings
//   → add a binding named   USERS   pointing at a KV namespace.
//
// Endpoints (all POST JSON to /auth with an "action" field):
//   { action:'signup',  email, password, name }  → { token, user }
//   { action:'login',   email, password }        → { token, user }
//   { action:'session', token }                  → { user }
//   { action:'logout',  token }                  → { success:true }
//
// If the USERS binding is missing, returns 503 so the client falls back to
// local-only mode gracefully (good for previews / first deploy).

const SESSION_TTL = 60 * 60 * 24 * 90; // 90 days

const json = (obj, status = 200) =>
  new Response(JSON.stringify(obj), {
    status,
    headers: {
      'Content-Type': 'application/json',
      'Access-Control-Allow-Origin': '*',
      'Access-Control-Allow-Methods': 'POST, OPTIONS',
      'Access-Control-Allow-Headers': 'Content-Type',
    },
  });

// ── crypto helpers (PBKDF2-SHA256, salted) ──────────────
const enc = new TextEncoder();
const toHex = (buf) =>
  [...new Uint8Array(buf)].map((b) => b.toString(16).padStart(2, '0')).join('');
const fromHex = (hex) =>
  new Uint8Array(hex.match(/.{1,2}/g).map((b) => parseInt(b, 16)));

async function hashPassword(password, saltHex) {
  const salt = saltHex ? fromHex(saltHex) : crypto.getRandomValues(new Uint8Array(16));
  const key = await crypto.subtle.importKey('raw', enc.encode(password), 'PBKDF2', false, ['deriveBits']);
  const bits = await crypto.subtle.deriveBits(
    { name: 'PBKDF2', salt, iterations: 100000, hash: 'SHA-256' },
    key,
    256
  );
  return { salt: toHex(salt), hash: toHex(bits) };
}

// constant-time-ish compare
function safeEqual(a, b) {
  if (a.length !== b.length) return false;
  let out = 0;
  for (let i = 0; i < a.length; i++) out |= a.charCodeAt(i) ^ b.charCodeAt(i);
  return out === 0;
}

const validEmail = (e) => /^[^\s@]+@[^\s@]+\.[^\s@]+$/.test(e);

export async function onRequest(context) {
  const { request, env } = context;

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

  try {
    // ── SIGN UP ──────────────────────────────────────────
    if (action === 'signup') {
      if (!validEmail(email)) return json({ error: 'Please enter a valid email address.' }, 400);
      if (password.length < 6) return json({ error: 'Password must be at least 6 characters.' }, 400);
      if (!name) return json({ error: 'Please enter your name.' }, 400);

      const existing = await env.USERS.get('user:' + email);
      if (existing) return json({ error: 'Account already exists with this email — sign in instead.' }, 409);

      const { salt, hash } = await hashPassword(password);
      const user = { email, name, salt, hash, joinedAt: new Date().toISOString() };
      await env.USERS.put('user:' + email, JSON.stringify(user));

      const token = await createSession(env, email);
      return json({ token, user: { email, name } });
    }

    // ── LOG IN ───────────────────────────────────────────
    if (action === 'login') {
      if (!validEmail(email)) return json({ error: 'Please enter a valid email address.' }, 400);
      const raw = await env.USERS.get('user:' + email);
      if (!raw) return json({ error: 'Wrong email or password. New here? Create an account.' }, 401);

      const user = JSON.parse(raw);
      const { hash } = await hashPassword(password, user.salt);
      if (!safeEqual(hash, user.hash)) {
        return json({ error: 'Wrong email or password. New here? Create an account.' }, 401);
      }

      const token = await createSession(env, email);
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

    return json({ error: 'Unknown action' }, 400);
  } catch (err) {
    return json({ error: 'Server error', detail: err.message }, 500);
  }
}

async function createSession(env, email) {
  const token = crypto.randomUUID() + crypto.randomUUID().replace(/-/g, '');
  await env.USERS.put('session:' + token, email, { expirationTtl: SESSION_TTL });
  return token;
}
