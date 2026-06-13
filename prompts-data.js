/* prompts-data.js — the PromptAI prompt library seed (R31).
   50 prompts across 6 categories. Keep each one: role → context → format → constraint.
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

  // ── Growth pack (R32, June 13) ──────────────────────────
  {
    cat: "Writing", title: "Resume bullets that prove impact",
    why: "Turns \"responsible for X\" into evidence — the rewrite recruiters actually notice.",
    hint: "Works for LinkedIn summaries too.",
    prompt: `Rewrite my resume bullets so each one proves impact instead of listing duties.

Role: [TITLE, COMPANY, WHAT THE TEAM DID]
My bullets:
- [PASTE BULLETS]

Rules: start with a strong verb, include a number wherever one plausibly exists (ask me for it rather than inventing one), cut anything a peer in the same job couldn't also claim, max 20 words per bullet.

Return: the rewritten bullets, then the list of numbers/facts you need from me to make the weak ones stronger.`
  },
  {
    cat: "Writing", title: "Say no without burning the bridge",
    why: "The decline email you rewrite five times, done in one pass — clear, warm, final.",
    prompt: `Help me decline this request without damaging the relationship.

The request: [WHAT THEY ASKED]
Who they are to me: [boss / client / friend / stranger]
Why I'm saying no (the real reason): [BE HONEST]
What I'd still offer, if anything: [alternative / nothing]

Write 2 versions: one short (3 sentences) and one warmer (5-6 sentences). No fake excuses, no "unfortunately due to current circumstances", and no leaving the door open if I want it closed.`
  },
  {
    cat: "Writing", title: "Tone transplant",
    why: "Keeps your meaning, swaps the register — formal to friendly, blunt to diplomatic, and back.",
    prompt: `Rewrite the text below in a different tone. Target tone: [e.g. warmer / more direct / more formal / plainer English].

Keep: every factual point, my key phrases where they work, roughly the same length.
Change: only the register and word choice.
Do NOT add new content, hedge my asks, or soften any deadline.

Return the rewrite, then a 3-line summary of what you changed and why.

Text:
[PASTE TEXT]`
  },
  {
    cat: "Writing", title: "Executive summary in 150 words",
    why: "Compresses any document into the version a busy decision-maker will actually read.",
    prompt: `Write a 150-word executive summary of the document below for [WHO WILL READ IT].

Structure: 1 sentence of context → the core finding or ask → 3 bullets of supporting evidence → what happens next (1 sentence, include the deadline if there is one).

Rules: no sentence over 20 words, no jargon the reader wouldn't use themselves, numbers beat adjectives. If the document buries a decision that needs making, surface it first.

Document:
[PASTE DOCUMENT]`
  },
  {
    cat: "Coding", title: "Commit message and PR description",
    why: "Writes the PR description your reviewer wishes you had written — from the diff itself.",
    prompt: `Here is my diff (or a summary of my changes):
[PASTE DIFF OR DESCRIBE CHANGES]

Write:
1. A commit message: imperative subject line under 50 characters, body explaining WHY (not what) in 2-4 lines
2. A PR description: what changed, why now, how to test it, what reviewers should look hardest at, and any follow-up deliberately left out
3. Flag anything in the diff that looks unrelated to the stated purpose — reviewers always find it anyway.`
  },
  {
    cat: "Coding", title: "SQL from plain English",
    why: "Gets you a query AND the paranoia — assumptions, edge cases and a safety check before you run it.",
    prompt: `Write a SQL query: [WHAT YOU WANT, IN PLAIN ENGLISH]

Schema (tables + relevant columns):
[PASTE SCHEMA OR DESCRIBE IT]
Dialect: [Postgres / MySQL / SQLite / BigQuery]

Return:
1. The query, formatted and commented
2. Every assumption you made about my schema or data (nulls, duplicates, time zones)
3. What could make this query slow at scale, and the index that would fix it
4. If the query modifies data: the SELECT to run first to preview exactly what will change.`
  },
  {
    cat: "Coding", title: "Refactor, but prove nothing broke",
    why: "Refactoring without tests is gambling. This makes the model show its safety reasoning.",
    prompt: `Refactor this code for readability and maintainability WITHOUT changing its behavior.

\`\`\`
[PASTE CODE]
\`\`\`

Rules:
1. List the specific smells you're fixing (and the ones you're deliberately leaving alone)
2. Show the refactored code
3. Prove behavior is unchanged: walk the same 3 inputs through the old and new versions step by step
4. If anything in the original is ambiguous, say so — don't silently pick an interpretation.`
  },
  {
    cat: "Coding", title: "Decode this error",
    why: "Turns a cryptic stack trace into what actually happened, where, and the 3 most likely fixes.",
    hint: "Paste the FULL error — truncated traces produce guesses.",
    prompt: `Decode this error:

\`\`\`
[PASTE FULL ERROR / STACK TRACE]
\`\`\`

Context: [language/framework + what I was doing when it happened]

1. Translate the error into one plain-English sentence
2. Point to the exact line or frame that matters — most of the trace is noise, say which part
3. The 3 most likely causes, ranked, each with a 30-second check
4. If you need more information to be sure, name the ONE thing I should paste next.`
  },
  {
    cat: "Research", title: "Honest summarizer",
    why: "A summary you can trust, because it tells you what it left out.",
    prompt: `Summarize the text below at three lengths: one sentence, one paragraph, one outline.

Then — and this is the important part — list:
1. What I lose at each compression level (the nuance that didn't survive)
2. Anything you're uncertain you represented fairly
3. The strongest claim the text makes that the evidence inside it does NOT fully support

Text:
[PASTE TEXT]`
  },
  {
    cat: "Research", title: "Pre-mortem",
    why: "Imagine the project already failed, then work backwards — finds the risks optimism hides.",
    prompt: `Run a pre-mortem on my plan.

The plan: [DESCRIBE PROJECT, TIMELINE, WHO'S INVOLVED]

It is [6 months] from now and the project failed badly.
1. Write the 5 most plausible post-mortem headlines (one line each)
2. For each: the early warning sign that would show up FIRST, and when
3. The single cheapest mitigation I could put in place this week
4. Which failure mode you'd bet on, and why.`
  },
  {
    cat: "Research", title: "Question bank for an expert interview",
    why: "Better questions than \"tell me about your journey\" — built from what only THIS person can answer.",
    prompt: `I'm interviewing [WHO — name/role] about [TOPIC] for [podcast / research / hiring / customer discovery].

What I already know: [2-3 lines]
What I actually want to find out: [the real goal]

Write 12 questions:
- 3 warm-ups that aren't generic
- 6 core questions targeting what only this person can answer — concrete, and no two that could get the same answer
- 2 that respectfully challenge their known position
- 1 closer that tends to produce a quotable answer

Order them, and mark the 4 to keep if I only get ten minutes.`
  },
  {
    cat: "Research", title: "Statistics sanity check",
    why: "Checks the number before you repeat it — base rates, denominators, and what the stat conveniently omits.",
    prompt: `Sanity-check this statistic before I repeat it:

"[PASTE THE CLAIM, WITH SOURCE IF YOU HAVE IT]"

1. What exactly is being measured — and what would most people ASSUME is being measured?
2. What's the denominator? Is a base rate doing hidden work?
3. What comparison is missing (vs. last year, vs. control, vs. the alternative)?
4. Who produced the number, and what would they want it to show?
5. Verdict: repeat freely / repeat with a caveat (give me the caveat) / don't repeat.`
  },
  {
    cat: "Marketing", title: "Customer interview script that won’t lie to you",
    why: "Questions about their life, not your idea — the only interviews that produce the truth.",
    prompt: `Write a customer discovery interview script.

My idea: [ONE LINE — what you think you're building]
Who I'm interviewing: [the person and their context]

Rules: no pitching, no hypotheticals ("would you use…"), only questions about actual past behavior, specifics over generalities, follow the money and the workarounds.

Give me: 1 opener, 8 core questions in deliberate order, 3 follow-up probes for when answers go vague, and the 3 answer-signals that would mean "this problem is real".`
  },
  {
    cat: "Marketing", title: "SEO content brief",
    why: "Briefs a writer (or yourself) properly: intent, structure, and what the top results all miss.",
    prompt: `Build an SEO content brief for the query: [TARGET KEYWORD/QUERY]

1. Search intent: what is the searcher actually trying to DO (not the literal words)?
2. The title + H2 outline that serves that intent fastest
3. The questions to answer (what "People also ask" would surface)
4. What the typical top-10 article on this gets wrong or pads — and how to be genuinely better, not longer
5. Internal-link suggestions, given my site also covers: [LIST RELATED TOPICS]
6. Realistic difficulty: what kind of site can actually rank for this? Be honest.`
  },
  {
    cat: "Marketing", title: "Case study from a messy customer call",
    why: "Turns a rambling \"yeah it’s been great\" call into a credible before/after story.",
    prompt: `Turn my notes into a one-page case study.

Customer: [NAME/TYPE — can be anonymized]
Notes or transcript:
[PASTE]

Structure: the situation before (in their words) → the breaking point → what changed → results with numbers (use ONLY numbers present in my notes — list what's missing and I'll go get it) → one pull-quote, verbatim from the transcript.

Tone: reported, not promotional. Banned words: "game-changer", "seamless", "delighted".`
  },
  {
    cat: "Marketing", title: "Ad angles matrix",
    why: "Ten ads that are actually different — each tests a distinct angle, not ten synonyms.",
    prompt: `Generate ad copy variants for [PRODUCT — what it is, who it's for, price].

Create a 10-ad matrix, each from a DIFFERENT angle: pain relief · time saved · money · status · honest urgency · social proof · contrarian take · before/after · "for people who…" · the anti-pitch (acknowledge the main objection upfront).

Per ad: headline (under 8 words) + body (under 25 words) + which angle it tests.
Then rank the 3 you'd test first for MY audience, and say why.`
  },
  {
    cat: "Learning", title: "Misconception sweep",
    why: "You don’t know what you know wrong. This lists the standard traps for any topic.",
    prompt: `List the most common misconceptions about [TOPIC] — the things people who've read a few articles typically believe wrongly.

For each (aim for 6-8):
1. The misconception, stated the way a believer would say it
2. Why it's wrong or what it oversimplifies, in 2-3 sentences
3. Where it comes from — what makes it sticky
4. A one-line correct replacement belief

Then quiz me on the 3 I'm most likely to hold, one at a time.`
  },
  {
    cat: "Learning", title: "Practice problems with a rubric",
    why: "Reading feels like learning; solving is learning. Generates problems at your actual level.",
    prompt: `Create practice problems for [TOPIC/SKILL] at my level.

My level: [beginner / "I can do X but not Y" / paste an example of your work]

Give me 5 problems, easiest to hardest:
- Each must require DOING the thing, not recalling facts about it
- No problem solvable by pattern-matching the previous one
- Include one problem with deliberately incomplete information — noticing that is part of the skill

Hold the answers. After each attempt, grade me against a rubric: right approach / right execution / what a stronger answer would add.`
  },
  {
    cat: "Learning", title: "Book gutting (read it smarter)",
    why: "For nonfiction you want the ideas from, not the 280 pages of anecdotes around them.",
    prompt: `I'm deciding whether — and how — to read [BOOK + AUTHOR].

1. The book's actual thesis, in 2 sentences
2. The 3-5 load-bearing ideas, each with the strongest evidence the book offers for it
3. What informed critics say it gets wrong or overclaims
4. Which chapters carry the substance and which are padding — be specific
5. If I should read a different book or paper on this topic instead, name it.

Be honest if the book is famous but thin. Many are.`
  },
  {
    cat: "Learning", title: "Language sparring partner",
    why: "A conversation partner that corrects you without derailing the conversation.",
    hint: "Works for any language the model speaks well.",
    prompt: `Be my [LANGUAGE] conversation partner. My level: [A2 / B1 / B2 — or describe it].

Rules:
- Stay in [LANGUAGE]; topic: [something I actually care about]
- Match my level, then push one notch above it
- When I make an error: respond to my MEANING first, then add a one-line correction at the end marked ✏️
- Track my 3 most repeated errors; every 10 exchanges, drill me on them
- If I fall back to English because I'm stuck, give me the phrase I needed and continue.

Start with a question about my day.`
  },
  {
    cat: "Productivity", title: "Brain dump → action plan",
    why: "Empties the 2am head-noise into a list where every item is actionable, scheduled, or consciously dropped.",
    prompt: `Below is an unfiltered brain dump. Organize it:

1. ACTIONS — things with a concrete next step. Rewrite each as "verb + object", under 10 words
2. DECISIONS I'm avoiding — state each as the actual question to answer
3. WORRIES with no action attached — name them as exactly that (naming them is the point)
4. SOMEDAY/MAYBE — park without guilt
5. The ONE item that, handled this week, quiets the most of the rest

Don't invent tasks I didn't imply.

Brain dump:
[PASTE EVERYTHING]`
  },
  {
    cat: "Productivity", title: "Calendar autopsy",
    why: "Your calendar is a confession. This finds what to cut, shrink, or delegate.",
    prompt: `Audit my typical week.

My actual job is: [WHAT YOU'RE PAID TO ACHIEVE]
My calendar last week:
[PASTE OR LIST MEETINGS + DURATIONS]

For each recurring item, rule: keep / shrink (to what length?) / make async / delegate / kill — with one line of reasoning tied to my actual job.
Then: total hours reclaimed, what those hours should go to, and a polite script for the awkward "I'm leaving this meeting" message.`
  },
  {
    cat: "Productivity", title: "Plan today like a realist",
    why: "A day plan that survives contact with reality, because it budgets for interruptions.",
    prompt: `Plan my day. Be realistic, not aspirational.

Must do today: [LIST]
Want to do: [LIST]
Fixed commitments: [meetings + times]
My energy pattern: [e.g. sharp mornings, dead after 3pm]
Honest interruption level: [low / medium / constant]

Rules: deep work goes in my best hours; batch the shallow tasks; schedule at most 70% of available time; give every task a realistic duration (double my optimistic ones); name the FIRST task with a start time.
If the must-dos don't fit, tell me what to drop — don't compress everything.`
  },
  {
    cat: "Productivity", title: "Delegation brief",
    why: "Most delegation fails in the handoff. This writes the brief that prevents the rework.",
    prompt: `Write a delegation brief for a task I'm handing off.

Task: [WHAT NEEDS DOING]
Who's taking it: [their role + what they already know]
Deadline: [WHEN]

Include: the outcome (what "done" looks like, measurably) · context they need and where to find it · decisions they can make alone vs. must check with me · known traps · check-in points (max 2) · what I do NOT care about, so they don't polish it.
Keep it under 250 words. If it can't fit, the task needs splitting — tell me how.`
  },
  {
    cat: "Productivity", title: "Right-size this decision",
    why: "Separates decisions worth a week of agonizing from the ones to make in five minutes.",
    prompt: `Help me right-size this decision.

The decision: [WHAT YOU'RE DECIDING]
Options: [A / B / C]
What I'm afraid of: [be honest]

1. Is this reversible (a two-way door) or irreversible? Mostly-reversible counts as reversible.
2. What's the real cost of choosing wrong vs. the cost of deciding slowly?
3. If reversible: pick one NOW using my stated priorities, and define the checkpoint + the signal that would mean "switch"
4. If irreversible: the minimum information that would materially change the choice, and the cheapest way to get it this week.`
  },
];
