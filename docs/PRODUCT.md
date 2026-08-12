# Product

## Problem

Model benchmark leaderboards are mostly self-reported or LLM-judged — "model X
rated this response higher." Almost none of them actually *run* the code the
model wrote and check whether it works. For a coding benchmark specifically,
that's the one thing that actually matters.

## What Arena does

1. A coding challenge is active at any given time (rotates on a schedule).
2. Several LLMs, called through one unified endpoint, each attempt it independently.
3. Each attempt is executed for real, in isolation, against the challenge's test
   cases. Models get a bounded number of self-correction attempts if their first
   try fails.
4. Results (pass/fail, time-to-solve, attempts used, the actual code) are recorded
   and ranked.
5. A public leaderboard shows current and historical standings. A generated
   scorecard image summarizes each completed challenge and gets shared to Discord.
6. Anyone can propose a new challenge; it goes through moderation before entering
   rotation.

## Primary users

- **The operator (you).** Runs it as a public demo/portfolio piece and a genuine
  standing benchmark you actually look at. Moderates challenge submissions,
  tunes which models are in rotation.
- **Visitors.** Browse the live and historical leaderboard, watch a challenge
  resolve in near-real-time, optionally submit a challenge idea.
- **Discord community** (yours). Gets the daily result digest and scorecard
  image automatically — no one has to check the site to see who won.

## Core user stories, v1

- As a visitor, I can see the current challenge, which models are attempting it,
  and their live status (running / passed / failed / retrying), without refreshing.
- As a visitor, I can see the historical leaderboard: win rate, average
  time-to-solve, and streaks, per model.
- As a visitor, I can view any past challenge's full detail: the prompt, every
  model's actual submitted code, and its execution log.
- As a visitor, I can submit a challenge idea via a rate-limited public form.
- As the operator, I can flag/reject a submitted challenge, and control which
  models are active in rotation, without a deploy (Flags-driven).
- As a Discord member, I receive the daily digest automatically with a scorecard
  image and a link to the full result.

## Success criteria for v1

- A full benchmark cycle (challenge selected → all active models attempt it →
  results scored → leaderboard updated → Discord digest sent) completes
  end-to-end with zero manual steps.
- The public leaderboard loads fast or perceived-fast (ISR, not a live DB hit
  per visitor) and stays inside Hobby-plan limits under expected low-to-moderate
  traffic.
- Untrusted, LLM-generated code execution never touches anything outside its
  sandbox — this is the one requirement that cannot be "mostly" true. See
  `docs/SECURITY.md`.
- The whole thing runs on Vercel's free Hobby tier plus each Marketplace
  provider's own free tier. No paid Vercel plan required for v1.

## Out of scope for v1

- User accounts / auth for visitors. Nobody logs in to view or submit challenges.
- Arbitrary user-submitted *code* execution (only the challenge-idea *text* form
  is public — actual code execution is always model-generated, from a
  moderator-approved challenge, never directly from an anonymous visitor).
- Multi-tenant / white-label. This is one instance, one leaderboard.
- Sub-daily challenge rotation automation beyond what Hobby's once-daily Cron
  allows. If faster rotation is wanted later, that's a Pro-plan decision, not a
  v1 problem to solve around.
- Support for arbitrary programming languages beyond what the Sandbox template
  ships with initially (start with one language, expand later — see ROADMAP).
