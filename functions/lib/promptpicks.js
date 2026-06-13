// functions/lib/promptpicks.js
// Curated rotation for "Prompt of the week" in the email digest. Each entry's
// slug MUST match a real page under /prompt/<slug> (generated from
// prompts-data.js). We rotate deterministically by ISO week so every send in a
// given week features the same prompt, and it changes weekly without a cron.
//
// `hook` is a one-line "why you'd use this" — kept punchy for the email.

export const PROMPT_PICKS = [
  { slug: 'pre-mortem', title: 'Pre-mortem', hook: 'Imagine the project already failed, then work backwards to find the blind spots before you commit.' },
  { slug: 'code-review-like-a-senior-engineer', title: 'Code review like a senior engineer', hook: 'Paste a diff, get the review a staff engineer would actually give.' },
  { slug: 'executive-summary-in-150-words', title: 'Executive summary in 150 words', hook: 'Turn a long doc into something a busy exec will actually read.' },
  { slug: 'ruthless-editor', title: 'Ruthless editor', hook: 'Cut the fat from any draft without losing your voice.' },
  { slug: 'right-size-this-decision', title: 'Right-size this decision', hook: 'Stop over-thinking small calls and under-thinking big ones.' },
  { slug: 'explain-it-three-ways', title: 'Explain it three ways', hook: 'Get a concept explained for a novice, a peer, and an expert — pick what fits.' },
  { slug: 'first-draft-from-bullet-points', title: 'First draft from bullet points', hook: 'Hand it your messy notes, get a coherent first draft back.' },
  { slug: 'meeting-notes-decisions-actions', title: 'Meeting notes → decisions & actions', hook: 'Turn a wall of notes into who-owns-what by when.' },
  { slug: 'rubber-duck-a-bug', title: 'Rubber-duck a bug', hook: 'Talk through a bug with an AI that asks the right next question.' },
  { slug: 'learning-roadmap-for-any-topic', title: 'Learning roadmap for any topic', hook: 'Go from zero to a structured study plan for anything you want to learn.' },
  { slug: 'objection-mining', title: 'Objection mining', hook: 'Surface every objection to your pitch before your audience does.' },
  { slug: 'plan-today-like-a-realist', title: 'Plan today like a realist', hook: 'Build a to-do list that respects how much time you actually have.' },
];

// ISO-week index → deterministic weekly rotation.
export function promptOfTheWeek(date = new Date()) {
  const d = new Date(Date.UTC(date.getUTCFullYear(), date.getUTCMonth(), date.getUTCDate()));
  d.setUTCDate(d.getUTCDate() + 4 - (d.getUTCDay() || 7));
  const yearStart = new Date(Date.UTC(d.getUTCFullYear(), 0, 1));
  const week = Math.ceil((((d - yearStart) / 86400000) + 1) / 7);
  return PROMPT_PICKS[week % PROMPT_PICKS.length];
}
