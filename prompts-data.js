/* prompts-data.js — the PromptAI prompt library seed (R31).
   25 prompts across 6 categories. Keep each one: role → context → format → constraint.
   Edit/add prompts here; prompts.html renders whatever this array contains. */
window.PAI_PROMPTS = [
  // ── Writing ─────────────────────────────────────────────
  {
    cat: 'Writing', title: 'Ruthless editor',
    why: 'Tightens any draft without changing your meaning or voice — great last pass before publishing.',
    hint: 'Works on emails, posts, docs — anything under ~2,000 words.',
    prompt: `You are a ruthless line editor. Edit the text below to be 30% shorter without losing any substantive point. Keep my voice and terminology. Do not add new ideas.

Return:
1. The edited text
2. A bullet list of what you cut and why (one line each)

Text:
[PASTE YOUR DRAFT]`
  },
  {
    cat: 'Writing', title: 'First draft from bullet points',
    why: 'Turns rough notes into a structured draft you can react to, instead of staring at a blank page.',
    prompt: `Write a first draft of a [blog post / memo / announcement] from my notes below.

Audience: [who reads this and what they already know]
Tone: [e.g. plain, direct, no hype, no exclamation marks]
Length: about [400] words.
Structure: short intro stating the point, 2-4 sections with headers, one-line takeaway at the end.

My notes:
- [point 1]
- [point 2]
- [point 3]`
  },
  {
    cat: 'Writing', title: 'Subject line generator with a twist',
    why: 'Gets past generic subject lines by forcing variety across distinct styles, then self-ranking.',
    prompt: `Write 10 subject lines for the email below.
Mix: 3 plain/descriptive, 3 curiosity-driven (no clickbait), 2 with a number, 2 ultra-short (under 5 words).
Then mark which ONE you'd send and justify it in one sentence based on the email's actual content.

Email:
[PASTE EMAIL]`
  },
  {
    cat: 'Writing', title: 'Explain it three ways',
    why: 'The fastest way to find the right level for your audience — compare all three and steal the best.',
    prompt: `Explain [TOPIC] three times:
1. To a domain expert (precise, technical, 3 sentences)
2. To a smart colleague in a different field (no jargon, 5 sentences)
3. To a curious 12-year-old (one analogy, 3 sentences)

Keep all three factually correct — simplify by removing detail, never by making things up.`
  },
  // ── Coding ──────────────────────────────────────────────
  {
    cat: 'Coding', title: 'Code review like a senior engineer',
    why: 'Structured review that prioritizes real risks over style nits.',
    prompt: `Review this code as a senior engineer. Prioritize in this order:
1. Bugs and edge cases that will actually break
2. Security issues
3. Performance problems with real impact
4. Readability/maintainability

For each finding: severity (high/med/low), the line(s), why it matters, and a concrete fix. Skip pure style preferences. End with the one change you'd insist on before merging.

\`\`\`[language]
[PASTE CODE]
\`\`\``
  },
  {
    cat: 'Coding', title: 'Rubber-duck a bug',
    why: 'Forces the model to reason about the system instead of pattern-matching a generic fix.',
    prompt: `Help me debug. Don't guess at a fix yet.

What happens: [the actual behavior, error message, stack trace]
What I expected: [the correct behavior]
What I've tried: [attempts so far]
Relevant code:
\`\`\`
[PASTE]
\`\`\`

First: list the 3 most likely root causes ranked by probability, and for each, the ONE thing I should check to confirm or rule it out. Wait for my answer before proposing fixes.`
  },
  {
    cat: 'Coding', title: 'Write tests first',
    why: 'Test cases reveal the edge cases you forgot — often more valuable than the implementation itself.',
    prompt: `Write a test suite for the function described below, BEFORE seeing any implementation.

Function: [name, what it takes, what it returns]
Behavior: [what it should do]

Include: happy path, boundary values, empty/null inputs, malformed inputs, and at least one case you predict I haven't thought about (flag it with a comment). Use [pytest / Jest / your framework]. Then briefly note which cases are most likely to catch real bugs.`
  },
  {
    cat: 'Coding', title: 'Explain unfamiliar code',
    why: 'Three layers — what, how, why — so you can stop at the depth you need.',
    prompt: `Explain this code in three layers:
1. WHAT: one paragraph — what does it do, input to output?
2. HOW: walk through the flow, flagging any non-obvious technique or idiom
3. WHY: what design decisions were made, what alternatives existed, and any smells or risks you see

\`\`\`
[PASTE CODE]
\`\`\``
  },
  {
    cat: 'Coding', title: 'Regex with receipts',
    why: 'Regexes are write-only without tests. This makes the model prove its pattern works.',
    prompt: `Write a regex that: [DESCRIBE WHAT TO MATCH]

Flavor: [JavaScript / Python / PCRE]

Return:
1. The regex
2. A plain-English breakdown of each part
3. 5 strings it SHOULD match and 5 it should NOT — verify each one against your own pattern and mark pass/fail honestly
4. Known limitations`
  },
  // ── Research ────────────────────────────────────────────
  {
    cat: 'Research', title: 'Steelman both sides',
    why: 'Cuts through one-sided takes — useful before forming an opinion on anything contested.',
    prompt: `Topic: [CONTESTED QUESTION]

1. Give the strongest honest case FOR (the best advocates' actual arguments, not strawmen)
2. Give the strongest honest case AGAINST
3. List what both sides agree on
4. Identify the crux: the underlying disagreement (values? predictions? definitions?)
5. What evidence, if it existed, would settle this?

Do not tell me which side is right.`
  },
  {
    cat: 'Research', title: 'Paper deconstruction',
    why: 'The questions a good journal-club reviewer would ask, applied to any paper abstract or text.',
    prompt: `Deconstruct this paper:

1. Claim: what exactly do the authors claim, in one sentence?
2. Evidence: what did they actually measure/build, and does it support the claim?
3. Limits: what populations/conditions/scales does the evidence NOT cover?
4. Alternatives: what other explanations fit the same results?
5. Verdict: how much should this update my beliefs, on a scale from "noise" to "field-changing", and why?

Paper:
[PASTE ABSTRACT OR TEXT]`
  },
  {
    cat: 'Research', title: 'Learning roadmap for any topic',
    why: 'Replaces "where do I start" paralysis with a sequenced plan sized to your actual time budget.',
    prompt: `Build me a learning roadmap for [TOPIC].

My background: [what I already know]
My goal: [what I want to be able to DO afterwards]
Time budget: [e.g. 5 hours/week for 6 weeks]

Format: week-by-week. Each week: the ONE concept to master, why it comes at this point in the sequence, a concrete exercise to prove I got it, and the single best free resource (name real ones; if unsure a resource exists, say so).`
  },
  {
    cat: 'Research', title: 'Assumption auditor',
    why: 'Surfaces the hidden assumptions in a plan before reality does.',
    prompt: `Here is my plan:
[DESCRIBE PLAN]

List every assumption this plan depends on, sorted by (probability it's wrong × damage if wrong). For the top 3: how could I test the assumption cheaply THIS WEEK before committing? Be specific — name the test, the cost, and what result would falsify it.`
  },
  {
    cat: 'Research', title: 'Compare anything, honestly',
    why: 'Forces a real decision framework instead of a mushy "it depends".',
    prompt: `Compare [OPTION A] vs [OPTION B] for my situation:
[YOUR CONTEXT — what you're optimizing for, constraints, scale]

1. Build a comparison table on the 5 criteria that matter most FOR MY CONTEXT (justify the criteria)
2. State the winner per criterion — no ties allowed
3. Overall recommendation with confidence (low/med/high)
4. What single fact about my situation, if different, would flip your recommendation?`
  },
  // ── Marketing ───────────────────────────────────────────
  {
    cat: 'Marketing', title: 'Landing page copy from features',
    why: 'Converts feature lists into benefit-driven copy with the classic PAS structure.',
    prompt: `Write landing page copy for [PRODUCT].

Who it's for: [audience]
The pain: [the problem they feel, in their words]
Features: [list them]

Structure:
- Headline (under 10 words, benefit not feature)
- Subhead (one sentence: who it's for + the outcome)
- 3 benefit blocks: each pairs ONE feature with the outcome it buys
- One line of social proof placeholder
- CTA button text (2-4 words)

Tone: confident, concrete, zero buzzwords ("revolutionary", "seamless", "supercharge" are banned).`
  },
  {
    cat: 'Marketing', title: 'One idea, five channels',
    why: 'Stops copy-paste cross-posting — each channel gets its native format from one source idea.',
    prompt: `Take this one idea and adapt it natively for 5 channels:

Idea: [YOUR CORE MESSAGE OR LINK TO CONTENT]

1. X/Twitter: a 3-tweet thread, hook first, no hashtags
2. LinkedIn: 150-word post, line breaks for skimming, ends with a question
3. Email newsletter: subject + 80-word teaser that links out
4. Instagram caption: 2 sentences + 3 relevant hashtags
5. YouTube short: 30-second script with the hook in the first 5 seconds

Keep the core claim identical across all five — only the form changes.`
  },
  {
    cat: 'Marketing', title: 'Objection mining',
    why: 'Anticipates why people DON\'T buy — the highest-leverage marketing question.',
    prompt: `My product: [WHAT IT IS, PRICE, AUDIENCE]

List the 7 most likely objections a skeptical prospect has but won't say out loud. For each:
1. The objection in the prospect's internal voice ("This is probably just…")
2. Whether it's a misconception or a real limitation — be honest
3. The one-sentence response that addresses it without sounding defensive
4. Where to deploy that response (pricing page, FAQ, onboarding, ad copy)`
  },
  {
    cat: 'Marketing', title: 'Name generator with filters',
    why: 'Most name brainstorms die from vague criteria. This bakes the filters in upfront.',
    prompt: `Generate 20 name candidates for [PRODUCT/COMPANY/FEATURE — what it does].

Constraints: easy to spell after hearing it once, under [3] syllables, no generic AI clichés (no "ly", "ify", "genius", "mind"), works as a domain with some suffix, nothing too close to [COMPETITORS].

Format: name → 5-word rationale → gut-check score /10.
Then shortlist your top 3 and stress-test each: how could it be misread, mispronounced, or embarrassing in another language?`
  },
  // ── Learning ────────────────────────────────────────────
  {
    cat: 'Learning', title: 'Feynman technique, automated',
    why: 'You learn by explaining — this finds the gaps in your explanation.',
    prompt: `I'm going to explain [TOPIC] in my own words. Grade my explanation:

1. What did I get right?
2. What did I get wrong or oversimplify? (be specific)
3. What important part did I leave out entirely?
4. Ask me the one question that would most expose whether I really understand this.

My explanation:
[WRITE YOUR EXPLANATION — DON'T LOOK ANYTHING UP FIRST]`
  },
  {
    cat: 'Learning', title: 'Socratic tutor mode',
    why: 'Stops the model from lecturing and makes it teach through questions instead.',
    prompt: `Act as a Socratic tutor for [TOPIC]. Rules:
- Never explain something I could figure out — ask a leading question instead
- One question at a time, wait for my answer
- If my answer is wrong, don't correct me directly: ask a question that exposes the contradiction
- Every 5 exchanges, summarize what I've established so far
- Start by asking what I already believe about [TOPIC]

Begin.`
  },
  {
    cat: 'Learning', title: 'Spaced-repetition card writer',
    why: 'Good flashcards are atomic and test recall, not recognition. Most people write bad ones.',
    prompt: `Turn the material below into spaced-repetition flashcards.

Rules: one atomic fact per card; front must be a question (never "define X" — ask it the way it would come up in practice); back is under 25 words; include 2-3 "why/how" cards, not just "what" cards; skip anything trivially googleable that I'd never need from memory.

Format: Q: … / A: … pairs.

Material:
[PASTE NOTES OR TEXT]`
  },
  {
    cat: 'Learning', title: 'Prerequisite tree',
    why: 'Learning fails when you skip a prerequisite. Map them before you start.',
    prompt: `I want to understand [TARGET CONCEPT].

1. Draw the prerequisite tree: what concepts do I need first, and what do THOSE need? (max 3 levels deep, as an indented list)
2. Mark each node: ⚡ essential / 👍 helpful / 💤 skippable-for-now
3. Quiz me with one quick question per essential node to find where my actual frontier is
4. Based on my answers, tell me where to start.`
  },
  // ── Productivity ────────────────────────────────────────
  {
    cat: 'Productivity', title: 'Meeting notes → decisions & actions',
    why: 'The only two things that matter from any meeting, extracted and owner-assigned.',
    prompt: `From the meeting notes below, extract ONLY:

1. DECISIONS made (numbered; one line each; include who decided if stated)
2. ACTION ITEMS: owner → task → deadline (use "unassigned"/"no deadline" honestly rather than inventing)
3. OPEN QUESTIONS that were raised but not resolved
4. One-sentence summary I could paste into a status channel

Ignore all discussion that led nowhere.

Notes:
[PASTE NOTES OR TRANSCRIPT]`
  },
  {
    cat: 'Productivity', title: 'Inbox triage assistant',
    why: 'Drafts the three hardest reply types — decline, delegate, defer — in your voice.',
    prompt: `Draft a reply to the email below. My decision: [DECLINE / DELEGATE TO (name) / DEFER UNTIL (when) / ACCEPT WITH CONDITIONS].

Constraints: 4 sentences max, warm but unambiguous, no fake excuses, no "I hope this finds you well", offer a concrete alternative if I'm declining.

Email:
[PASTE EMAIL]`
  },
  {
    cat: 'Productivity', title: 'Weekly review interrogator',
    why: 'A weekly review you\'ll actually do, because the questions are asked one at a time.',
    prompt: `Run my weekly review. Ask me these one at a time, wait for each answer:

1. What actually moved forward this week? (not what was busy — what MOVED)
2. What did I avoid, and what was I really avoiding about it?
3. What took way longer than it should have? Why?
4. What's the ONE thing next week that makes everything else easier?
5. What am I saying no to, to protect that one thing?

Then summarize my answers into 5 lines I can save, and call out any pattern you notice vs. what I told you last time (if I paste it).`
  },
];
