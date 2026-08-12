# Arena

A live, multi-model coding benchmark. A challenge drops on a schedule. Several LLMs
get the same prompt, each one's solution actually **executes** in an isolated
sandbox — not just gets eyeballed — and the results, rankings, and a shareable
scorecard get posted automatically.

The point isn't a leaderboard on vibes. It's verifiable: every submission runs for
real before it gets a score.

## Start here

Read in this order:

1. [`docs/PRODUCT.md`](docs/PRODUCT.md) — what we're building and for whom, in plain
   terms, before any architecture.
2. [`docs/ARCHITECTURE.md`](docs/ARCHITECTURE.md) — the system, how every Vercel
   platform feature maps to a real role, and why it's shaped this way.
3. [`docs/DATA_MODEL.md`](docs/DATA_MODEL.md) — the schema, across all three stores
   (Postgres, Edge Config, Blob) and why each thing lives where it lives.
4. [`docs/WORKFLOWS.md`](docs/WORKFLOWS.md) — the actual step-by-step execution of
   a benchmark run, state by state.
5. [`docs/API.md`](docs/API.md) — every route, its contract, who calls it.
6. [`docs/SECURITY.md`](docs/SECURITY.md) — threat model. Read this before touching
   the sandbox-execution or public-submission paths. Not optional.
7. [`docs/DEVELOPMENT.md`](docs/DEVELOPMENT.md) — local setup, env vars, how to run
   it, and the git-worktree workflow for parallel agent work.
8. [`docs/ROADMAP.md`](docs/ROADMAP.md) — build phases, in an order designed so
   each phase is ownable by one worktree/agent without stepping on the others.

`CLAUDE.md` and `AGENTS.md` are the standing contract for any agent (human-directed
or autonomous) working in this repo — read whichever matches your runtime, they're
identical in substance.

## What this is not

Not a "vibes" leaderboard. Not a general-purpose AI playground. Not multi-tenant
SaaS — this is a single public site with one benchmark running at a time. Not built
for scale beyond Vercel's Hobby-plan limits on day one — see
[`docs/PRODUCT.md#out-of-scope`](docs/PRODUCT.md#out-of-scope-for-v1).
