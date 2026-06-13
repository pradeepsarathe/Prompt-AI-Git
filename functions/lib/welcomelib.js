// functions/lib/welcomelib.js
// Lifecycle email templates — the 3-part WELCOME SERIES + the DORMANT WIN-BACK.
//
// Pure, import-free template functions (no env, no fetch) so they can be unit-
// rendered for previews and reused by:
//   • functions/welcome-series.js  (daily drip — steps 1/2/3)
//   • functions/winback.js         (weekly re-engagement)
//   • functions/confirm.js         (optional immediate step-1, not used today)
//
// Brand: the NAVY "relationship" palette (#0a1628 masthead, #2563eb accent,
// Georgia headlines) — matching subscribe.js's confirmation email and the
// /confirm landing page, so the series feels continuous after sign-up. The
// content briefing keeps its own lighter #1a73e8 palette in send-digest.js.

const SITE = 'https://promptai.in';

const esc = (s) => (s || '')
  .replace(/&/g, '&amp;').replace(/</g, '&lt;').replace(/>/g, '&gt;').replace(/"/g, '&quot;');

// ── shared HTML shell ────────────────────────────────────────────────
// Every lifecycle email is: navy masthead · kicker · serif H1 · intro ·
// optional rows · primary button · footer with one-click unsubscribe.
function shell({ preheader, kicker, title, intro, rowsHtml = '', ctaText, ctaUrl, footerNote, unsubUrl }) {
  return `<!DOCTYPE html><html lang="en"><head>
<meta charset="UTF-8"/><meta name="viewport" content="width=device-width, initial-scale=1.0"/>
<meta name="x-apple-disable-message-reformatting"/>
<!--[if mso]><style>* { font-family: Helvetica, Arial, sans-serif !important; }</style><![endif]-->
</head>
<body style="margin:0;padding:0;background:#eef2f7;-webkit-text-size-adjust:100%;">
  <div style="display:none;max-height:0;overflow:hidden;opacity:0;color:transparent;height:0;width:0;">${esc(preheader)}</div>
  <table role="presentation" width="100%" cellpadding="0" cellspacing="0" style="background:#eef2f7;"><tr>
  <td align="center" style="padding:32px 16px;">
  <table role="presentation" width="600" cellpadding="0" cellspacing="0" style="width:600px;max-width:600px;background:#ffffff;border-radius:16px;overflow:hidden;box-shadow:0 8px 40px rgba(10,22,40,0.08);">

    <tr><td style="background:#0a1628;padding:26px 40px;">
      <table role="presentation" width="100%" cellpadding="0" cellspacing="0"><tr>
        <td style="font-family:Georgia,'Times New Roman',serif;font-size:22px;font-weight:bold;color:#ffffff;">
          <span style="display:inline-block;width:10px;height:10px;background:#2563eb;border-radius:50%;margin-right:9px;vertical-align:middle;"></span>PromptAI</td>
        <td align="right" style="font-family:Helvetica,Arial,sans-serif;font-size:11px;letter-spacing:1.5px;text-transform:uppercase;color:#64748b;">${esc(kicker)}</td>
      </tr></table></td></tr>

    <tr><td style="padding:40px 40px 6px;font-family:Helvetica,Arial,sans-serif;">
      <h1 style="margin:0;font-family:Georgia,'Times New Roman',serif;font-size:29px;line-height:1.22;color:#0a1628;font-weight:normal;">${esc(title)}</h1></td></tr>

    <tr><td style="padding:16px 40px 4px;font-family:Helvetica,Arial,sans-serif;font-size:16px;line-height:1.7;color:#475569;">
      ${intro}</td></tr>

    ${rowsHtml}

    <tr><td align="left" style="padding:24px 40px 8px;">
      <a href="${esc(ctaUrl)}" style="display:inline-block;padding:14px 30px;background:#2563eb;border-radius:10px;font-family:Helvetica,Arial,sans-serif;font-size:15px;font-weight:bold;color:#ffffff;text-decoration:none;">${esc(ctaText)}</a></td></tr>

    ${footerNote ? `<tr><td style="padding:14px 40px 0;font-family:Helvetica,Arial,sans-serif;font-size:13px;line-height:1.6;color:#94a3b8;">${footerNote}</td></tr>` : ''}

    <tr><td style="background:#f8fafc;border-top:1px solid #e2e8f0;padding:24px 40px;margin-top:24px;font-family:Helvetica,Arial,sans-serif;font-size:12px;line-height:1.7;color:#94a3b8;text-align:center;">
      <div style="font-family:Georgia,serif;font-size:14px;color:#0a1628;margin-bottom:6px;">PromptAI</div>
      You're getting this because you subscribed at promptai.in.<br/>
      <a href="${esc(unsubUrl)}" style="color:#2563eb;text-decoration:underline;">Unsubscribe</a> &nbsp;·&nbsp;
      <a href="${SITE}" style="color:#2563eb;text-decoration:underline;">Open the live feed</a></td></tr>

  </table>
  <div style="font-family:Helvetica,Arial,sans-serif;font-size:11px;color:#9aa0a6;padding:16px 0 0;">© 2026 PromptAI · promptai.in</div>
  </td></tr></table></body></html>`;
}

// A labelled feature row: glyph chip + bold lead-in + supporting line.
function row(glyph, lead, body) {
  return `
    <tr><td style="padding:16px 40px 0;font-family:Helvetica,Arial,sans-serif;">
      <table role="presentation" width="100%" cellpadding="0" cellspacing="0"><tr>
        <td width="42" valign="top" style="padding-right:14px;">
          <div style="width:38px;height:38px;border-radius:10px;background:#eff4ff;text-align:center;line-height:38px;font-size:18px;">${glyph}</div></td>
        <td valign="top" style="font-family:Helvetica,Arial,sans-serif;">
          <div style="font-size:15px;font-weight:bold;color:#0a1628;line-height:1.4;">${lead}</div>
          <div style="font-size:14px;line-height:1.6;color:#64748b;margin-top:3px;">${body}</div>
        </td>
      </tr></table></td></tr>`;
}

// Featured prompt-library link row (welcome #2).
function promptRow(slug, title, blurb) {
  const url = `${SITE}/prompt/${slug}`;
  return `
    <tr><td style="padding:12px 40px 0;font-family:Helvetica,Arial,sans-serif;">
      <a href="${url}" style="text-decoration:none;display:block;">
      <table role="presentation" width="100%" cellpadding="0" cellspacing="0" style="background:#f8fafc;border:1px solid #e7ecf3;border-radius:12px;"><tr>
        <td style="padding:14px 18px;font-family:Helvetica,Arial,sans-serif;">
          <div style="font-family:Georgia,serif;font-size:16px;font-weight:bold;color:#0a1628;">${esc(title)}</div>
          <div style="font-size:13.5px;line-height:1.55;color:#64748b;margin-top:3px;">${esc(blurb)}</div>
          <div style="font-size:12.5px;color:#2563eb;font-weight:bold;margin-top:7px;">Open the prompt →</div>
        </td>
      </tr></table></a></td></tr>`;
}

// ── WELCOME SERIES ────────────────────────────────────────────────────
// step 1 → ~Day 1, step 2 → ~Day 3, step 3 → ~Day 6 (thresholds live in
// welcome-series.js). ctx = { email, unsubUrl }.

export function welcomeEmail(step, ctx) {
  const { unsubUrl } = ctx;
  if (step === 1) {
    return {
      subject: 'Welcome to PromptAI 👋 (start here)',
      html: shell({
        preheader: 'How to get the most out of your AI briefing — in 30 seconds.',
        kicker: 'Welcome · 1 of 3',
        title: "You're in. Here's how to get the most out of PromptAI.",
        intro: `<p style="margin:0 0 6px;">Thanks for confirming — your first briefing is already on its way. Here's the 30-second orientation so PromptAI earns its spot in your week.</p>`,
        rowsHtml:
          row('⭐', 'Never miss it', 'Move <b>briefing@promptai.in</b> to your Primary tab (or add it to your contacts). A great briefing is useless in the Promotions folder.') +
          row('🔴', 'The feed is live all day', 'The briefing is the highlight reel — but <b>promptai.in</b> updates continuously. Bookmark it for the moment news breaks.') +
          row('🧰', '50 prompts, ready to steal', 'Our prompt library has 50 copy-paste prompts for writing, coding, research and planning. We\u2019ll show you around in a couple of days.'),
        ctaText: 'Explore the live feed →',
        ctaUrl: SITE,
        footerNote: 'Your briefing lands every Tuesday (or every morning, if you picked the daily). The site never sleeps.',
        unsubUrl,
      }),
      text: [
        'WELCOME TO PROMPTAI', '===================', '',
        "You're in. Thanks for confirming — your first briefing is on its way.",
        'Here is the 30-second orientation:', '',
        '1. NEVER MISS IT — move briefing@promptai.in to your Primary tab / contacts.',
        '2. THE FEED IS LIVE ALL DAY — bookmark https://promptai.in for breaking news.',
        '3. 50 PROMPTS, READY TO STEAL — a copy-paste library for writing, coding, research, planning.',
        '', 'Explore the live feed: ' + SITE, '',
        'Unsubscribe: ' + unsubUrl,
      ].join('\n'),
    };
  }
  if (step === 2) {
    return {
      subject: '50 AI prompts you can copy-paste today',
      html: shell({
        preheader: 'Steal these — built for writing, coding, research and planning.',
        kicker: 'The toolkit · 2 of 3',
        title: '50 prompts. Copy, paste, done.',
        intro: `<p style="margin:0 0 6px;">The fastest way to get good with AI is to start from something that already works. We wrote <b>50 battle-tested prompts</b> — each on its own page, ready to copy. A few to try first:</p>`,
        rowsHtml:
          promptRow('pre-mortem', 'Pre-mortem', 'Surface a plan\u2019s blind spots before you commit to it.') +
          promptRow('code-review-like-a-senior-engineer', 'Code review like a senior engineer', 'Paste a diff, get the review a staff engineer would give.') +
          promptRow('executive-summary-in-150-words', 'Executive summary in 150 words', 'Turn a long doc into something a busy exec actually reads.') +
          `<tr><td style="padding:18px 40px 0;font-family:Helvetica,Arial,sans-serif;font-size:14px;line-height:1.6;color:#64748b;">Prefer Hindi? <a href="${SITE}/prompts-hindi.html" style="color:#2563eb;text-decoration:none;font-weight:bold;">हिंदी प्रॉम्प्ट लाइब्रेरी →</a></td></tr>`,
        ctaText: 'Browse all 50 prompts →',
        ctaUrl: `${SITE}/prompts.html`,
        unsubUrl,
      }),
      text: [
        'PROMPTAI — 50 PROMPTS YOU CAN STEAL', '===================================', '',
        'Each prompt has its own page, ready to copy. Start here:', '',
        '• Pre-mortem: ' + SITE + '/prompt/pre-mortem',
        '• Code review like a senior engineer: ' + SITE + '/prompt/code-review-like-a-senior-engineer',
        '• Executive summary in 150 words: ' + SITE + '/prompt/executive-summary-in-150-words',
        '', 'Prefer Hindi? ' + SITE + '/prompts-hindi.html',
        '', 'Browse all 50: ' + SITE + '/prompts.html', '',
        'Unsubscribe: ' + unsubUrl,
      ].join('\n'),
    };
  }
  // step 3
  return {
    subject: 'Make PromptAI yours — daily or weekly?',
    html: shell({
      preheader: 'Pick your pace, share it, and a couple of corners worth a look.',
      kicker: 'Your call · 3 of 3',
      title: 'Tune PromptAI to your pace.',
      intro: `<p style="margin:0 0 6px;">You\u2019ve had a few briefings now — here\u2019s the quick housekeeping so it fits your life:</p>`,
      rowsHtml:
        row('⏱️', 'Daily or weekly?', 'Want it every morning, or just the Tuesday digest? Switch anytime from the subscribe box — your choice sticks.') +
        row('📨', 'Know someone who\u2019d like it?', 'Forward this email, or send them the one-tap signup at promptai.in. Word of mouth is how we grow.') +
        row('📚', 'Two corners worth a look', 'Every past issue lives in the <b>Archive</b>, and <b>Learn AI</b> is a from-scratch course — both linked below.'),
      ctaText: 'Manage your briefing →',
      ctaUrl: `${SITE}/#newsletter`,
      footerNote: `Explore: <a href="${SITE}/archive.html" style="color:#2563eb;text-decoration:none;font-weight:bold;">Archive</a> · <a href="${SITE}/education.html" style="color:#2563eb;text-decoration:none;font-weight:bold;">Learn AI</a> · <a href="${SITE}/prompts.html" style="color:#2563eb;text-decoration:none;font-weight:bold;">Prompts</a>`,
      unsubUrl,
    }),
    text: [
      'PROMPTAI — MAKE IT YOURS', '========================', '',
      '• DAILY OR WEEKLY? Switch anytime from the subscribe box: ' + SITE + '/#newsletter',
      '• SHARE IT: forward this email or send a friend to ' + SITE,
      '• EXPLORE: Archive ' + SITE + '/archive.html  ·  Learn AI ' + SITE + '/education.html',
      '', 'Manage your briefing: ' + SITE + '/#newsletter', '',
      'Unsubscribe: ' + unsubUrl,
    ].join('\n'),
  };
}

// ── DORMANT WIN-BACK ──────────────────────────────────────────────────
// Sent to subscribers who haven't opened in ~60 days. ctx = { email, unsubUrl }.
export function winbackEmail(ctx) {
  const { unsubUrl } = ctx;
  return {
    subject: 'Still want the AI briefing? 👀',
    html: shell({
      preheader: "It's been a while — two clicks to stay, or to go (no hard feelings).",
      kicker: 'We miss you',
      title: 'Your PromptAI briefings have gone quiet.',
      intro: `<p style="margin:0 0 6px;">We noticed you haven\u2019t opened a briefing in a while. Inboxes get noisy — we get it. Two quick options:</p>`,
      rowsHtml:
        row('✅', 'Keep me in', 'One tap on the button below and we\u2019ll keep the briefings coming — starting with today\u2019s.') +
        row('🐢', 'Too much email?', `Switch to the <a href="${SITE}/#newsletter" style="color:#2563eb;text-decoration:none;font-weight:bold;">once-a-week digest</a> instead of daily — same value, lighter touch.`) +
        row('👋', 'Not for you anymore?', 'No hard feelings — <a href="' + esc(unsubUrl) + '" style="color:#2563eb;text-decoration:none;font-weight:bold;">unsubscribe in one click</a>. We\u2019d rather keep a clean list than crowd your inbox.'),
      ctaText: "Show me what I've missed →",
      ctaUrl: SITE,
      footerNote: 'If you don\u2019t open anything in the next few weeks we\u2019ll quietly pause your briefings — so this is the last nudge unless you come back.',
      unsubUrl,
    }),
    text: [
      'PROMPTAI — STILL WANT THE BRIEFING?', '==================================', '',
      "We noticed you haven't opened a briefing in a while. Two options:", '',
      '• KEEP ME IN — open today\u2019s briefing: ' + SITE,
      '• TOO MUCH EMAIL? — switch to weekly: ' + SITE + '/#newsletter',
      '• NOT FOR YOU? — unsubscribe in one click: ' + unsubUrl,
      '', 'If you don\u2019t open anything in the next few weeks we\u2019ll quietly pause your briefings.',
    ].join('\n'),
  };
}
