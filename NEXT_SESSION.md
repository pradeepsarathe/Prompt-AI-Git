# PromptAI — Next Session Punch List

_Logged June 5, 2026. Nothing built this session — this is the to-do for next time._

## 1. News section — fix broken sources
These are **not loading** in the News section and need replacing or repairing:
- MIT Sloan
- The Verge
- Meta AI
- The Batch (deeplearning.ai)
- Anthropic

→ Test each RSS feed, repair the ones that are fixable, and **replace the dead ones** with reliable equivalents.

## 2. Deprioritize Hacker News
- HN is surfacing too much low-quality / off-topic news.
- Keep HN in the feed, but push it to the **bottom** — it should appear **last**, after all other sources.

## 3. Add a Research section
Pull research/papers from top labs & academic institutions:
- **Companies:** Anthropic, OpenAI, Google, Microsoft (+ Meta, DeepMind)
- **Academia:** Harvard, MIT, Stanford, and other top universities
- Best research orgs worldwide.

## 4. Bug — Learning & History not saving after login
- After a user logs in, **nothing gets saved** in Learning and in History.
- Investigate the persistence path post-login and fix so progress/history actually stores.

## 5. "Articles read today" — make it global + cross-device
- Currently tied to the personal account / single device.
- Should be **synced across devices** (like visitor count).
- Should count **total articles read across the whole website**, not per personal account.

## 6. ~~"Clear archive" button~~ ✅ DONE
- Button removed from archive.html (live + deploy) along with its `clearArchive()` function.
