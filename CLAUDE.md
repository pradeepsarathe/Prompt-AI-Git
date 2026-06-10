# Prompt AI — Project Instructions

## ALWAYS read the git code first
Before making any changes, **always read the actual code from the GitHub repo**
`pradeepsarathe/Prompt-AI-Git` (default branch). This repo is the **source of truth** —
it auto-deploys to production via Cloudflare Pages.

- Do NOT trust the local folder copies (`promptai-deploy/`, `promptai-latest/`,
  `promptai-site/`, `promptai-update/`, or even root-level files) as canonical — they
  can drift from what's actually deployed.
- Pull / read the live files from git first, base edits on those, then hand back changes
  to deploy into the repo.

## Deploy target
- Repo: `pradeepsarathe/Prompt-AI-Git`
- Host: Cloudflare Pages (auto-deploy on push to default branch)
- Requires `STATS` KV namespace binding for visitor/read counters.

## Open punch list
See `NEXT_SESSION.md` for the current to-do list.
