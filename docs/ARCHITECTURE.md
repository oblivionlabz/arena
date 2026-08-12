# Architecture

## Shape of the system

```
                          ┌─────────────────────┐
                          │   Cron (daily)       │
                          │   rotate challenge    │
                          └──────────┬───────────┘
                                     │ triggers
                                     ▼
                          ┌─────────────────────┐
   AI Gateway  ◄──────────┤   Benchmark Workflow  │──────────► Vercel Sandbox
   (model calls)          │   (Workflows, durable)│            (code execution,
                          └──────────┬───────────┘             isolated per attempt)
                                     │ writes
                       ┌─────────────┼─────────────┐
                       ▼             ▼              ▼
                Neon Postgres   Vercel Blob     Edge Config
                (leaderboard,   (code + logs,   (active challenge,
                 run history)    write-once)     rotation state)
                       │
                       ▼
              ┌─────────────────┐        ┌──────────────────┐
              │  Public site      │ ISR    │  OG Image gen      │
              │  (leaderboard,    │◄───────┤  (@vercel/og,      │
              │   challenge view) │        │   scorecards)      │
              └─────────┬─────────┘        └──────────────────┘
                        │
                        ▼
              ┌─────────────────┐
              │  Connect          │──────► Discord (digest post)
              │  (scoped tokens)  │──────► GitHub (optional PR)
              └─────────────────┘

   Firewall (rate limits the public challenge-submission endpoint)
   Flags (model rotation, chaos mode — no-deploy toggles)
   Web Analytics + Speed Insights + Observability (cross-cutting, all requests)
```

## Component responsibilities

### Benchmark Workflow (Vercel Workflows, beta)

The actual race. One workflow run per challenge cycle, fanned out per model. Each
model's branch is: generate solution → execute in Sandbox → check test results →
if failed and attempts remain, feed the failure back to the model and retry →
record final result. See `docs/WORKFLOWS.md` for the full state machine — this
file only covers *why* Workflows is the right tool: it survives a redeploy or a
slow model mid-run (durable, replay-based), and `sleep()` lets a model that's
still "thinking" hold its place without holding compute.

### Vercel Sandbox

Where model-written code actually executes. One sandbox per attempt, torn down
after. This is the trust boundary — see `docs/SECURITY.md`. Nothing about a
model's code is trusted until it's finished running inside one of these and the
sandbox is gone.

### AI Gateway

One endpoint, multiple providers, no per-provider API key management. The
Workflow calls it once per model per attempt. Free-tier credit budgets the
rotation size — see `docs/DATA_MODEL.md` for how model config (which models,
which provider) is stored and changed without a deploy.

### Data stores — three, each for a reason

- **Neon Postgres** (Marketplace) — the leaderboard and full run history. This is
  relational: "average time-to-solve for model X across the last 30 challenges"
  is a real query, not something you reconstruct from a KV store.
- **Edge Config** — the *current* challenge and rotation state. Read on every
  page load (that's the point — sub-millisecond, no DB round trip for the one
  piece of state almost every request needs), written once a day by Cron. This
  split exists specifically because Edge Config's free tier is
  100K-reads/100-writes-a-month shaped, and Postgres's is not — putting
  high-read low-write state in Postgres would work, but it's the wrong tool and
  it's not free the same way.
- **Vercel Blob** — the actual code and execution logs per attempt, written
  once when an attempt finishes. **Write-once. Never polled, never rewritten in
  place.** This constraint is not arbitrary — see `docs/SECURITY.md`'s note on
  the Blob incident this project's own operator hit on a *different* Vercel
  project the same day this was designed: a 30-second polling write pattern
  blew through the entire monthly Advanced Operations quota in under a day.
  Arena's write pattern is bounded by challenge frequency (at most a few dozen
  writes/day), not a timer, on purpose.

### Public site (Next.js, ISR)

The leaderboard and challenge-detail pages are ISR, not server-rendered per
request — they revalidate on an interval, so a traffic spike doesn't turn into
a Postgres connection spike. The "live" in-progress-challenge view is the one
page that needs to feel real-time; see `docs/API.md` for how that's done without
falling back to a raw client-side poll loop (short-interval polling against a
static page, capped and cheap — not a websocket, Hobby doesn't need one here).

### Connect (beta)

Posts the digest to Discord and, optionally, opens a GitHub PR with a winning
solution — using short-lived, project-scoped tokens requested at call time,
never a long-lived bot secret sitting in an environment variable. This is a
deliberate choice, not just "the feature exists so we used it": a public project
whose whole premise is executing untrusted code is exactly the kind of thing
that should not also be holding a permanent Discord/GitHub credential in plain
env-var storage.

### Flags

Two live toggles that matter operationally, not decoration: which models are
active in the day's rotation, and a "chaos mode" flag that swaps in a
deliberately adversarial test case for pre-release QA of scoring logic. Both are
flippable from the Vercel Toolbar without a deploy.

### Firewall

The one public write-adjacent surface — the challenge-submission form — gets a
custom rate-limit rule. This is a small, explicit decision, not "the firewall is
on so we're covered": three custom rules are the entire Hobby allowance, so each
one is spent deliberately. See `docs/SECURITY.md`.

### Observability, Analytics, Speed Insights

Cross-cutting. The one specifically worth calling out: OTel tracing
(`@vercel/otel`) across the Workflow → Sandbox → Blob-write chain, because that
chain is the one place a silent failure would be expensive to debug blind —
a challenge cycle that "completes" with a wrong score is worse than one that
visibly errors.

## What's deliberately not used, and why

- **Vercel Agent** — Pro/Enterprise-only as of this writing. Not available on
  the plan this project targets.
- **Rolling Releases / Skew Protection** — same, Pro/Enterprise-only.
- **Container Registry / Images (Beta)** — Sandbox already provides isolated
  execution; standing up a custom container registry on top would be
  complexity with no corresponding requirement in v1.

## Deployment topology

Single Vercel project, single environment split (production + preview via
normal Git-branch deploys). No multi-region requirement for v1 — Hobby Functions
are single-region (`iad1`) regardless, so there's nothing to design around here
yet.
