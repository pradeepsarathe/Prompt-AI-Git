// functions/e/open.js  →  route:  /e/open?e=<email>
// 1×1 transparent open-tracking pixel.
//
// send-digest.js embeds <img src="https://promptai.in/e/open?e=…"> at the foot
// of every briefing. When a subscriber's mail client loads images, this fires
// and stamps `lastOpenAt` on their SUBSCRIBERS record — the engagement signal
// the dormant win-back (functions/winback.js) keys off.
//
// Privacy / cost notes:
//   • First-party only: no third parties, no cookies, no fingerprinting.
//   • We store a coarse timestamp, nothing about the device or message.
//   • WRITE-THROTTLED to once per UTC day per subscriber, so a subscriber who
//     opens a briefing ten times still costs one KV write — keeps us well
//     inside Cloudflare KV's free-tier daily write budget.
//   • Always returns the pixel (cache-busting, no-store) even on bad input, so
//     a broken/missing email never shows a broken image in someone's inbox.

// 1×1 transparent GIF.
const PIXEL = Uint8Array.from([
  0x47, 0x49, 0x46, 0x38, 0x39, 0x61, 0x01, 0x00, 0x01, 0x00, 0x80, 0x00, 0x00,
  0x00, 0x00, 0x00, 0xff, 0xff, 0xff, 0x21, 0xf9, 0x04, 0x01, 0x00, 0x00, 0x00,
  0x00, 0x2c, 0x00, 0x00, 0x00, 0x00, 0x01, 0x00, 0x01, 0x00, 0x00, 0x02, 0x02,
  0x44, 0x01, 0x00, 0x3b,
]);

function pixel() {
  return new Response(PIXEL, {
    status: 200,
    headers: {
      'Content-Type': 'image/gif',
      'Cache-Control': 'no-store, no-cache, must-revalidate, max-age=0',
      'Content-Length': String(PIXEL.length),
    },
  });
}

export async function onRequest(context) {
  const { request, env } = context;
  try {
    const url = new URL(request.url);
    const email = (url.searchParams.get('e') || '').trim().toLowerCase();
    const valid = /^[^\s@]+@[^\s@]+\.[^\s@]+$/.test(email);

    if (valid && env.SUBSCRIBERS) {
      const raw = await env.SUBSCRIBERS.get(email);
      if (raw) {
        let rec = null;
        try { rec = JSON.parse(raw); } catch (e) { rec = null; }
        if (rec) {
          const today = new Date().toISOString().slice(0, 10);
          const lastDay = (rec.lastOpenAt || '').slice(0, 10);
          if (lastDay !== today) { // throttle: at most one write per UTC day
            rec.lastOpenAt = new Date().toISOString();
            rec.opens = (rec.opens || 0) + 1;
            await env.SUBSCRIBERS.put(email, JSON.stringify(rec));
          }
        }
      }
    }
  } catch (e) { /* never let tracking break the image */ }
  return pixel();
}
