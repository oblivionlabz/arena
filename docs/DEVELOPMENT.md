# Development

## Prerequisites

- Node.js (current LTS), `pnpm` (or `npm` — pick one and stay consistent, don't
  mix lockfiles).
- `vercel` CLI, logged in and linked to this project (`vercel link`).
- `gh` CLI if working across GitHub-hosted worktrees/PRs.

## First-time setup

```bash
git init                    # if not already a repo
vercel link                 # links this directory to the Vercel project
vercel env pull .env.local  # pulls real values for anything already configured
                             # in the Vercel dashboard; anything not yet
                             # configured needs a real value added there first —
                             # see .env.example for the full list and what each is
```

Provision the Marketplace database from the Vercel dashboard (Storage tab →
Neon Postgres → Connect to Project) rather than standing up Neon by hand — this
is what wires the connection string into env vars automatically and keeps
preview/production environments consistently configured.

## Environment variables

See `.env.example` at the repo root for the full list with descriptions. Do not
add a new required env var without adding it there in the same change — an
agent picking up a later task should never have to discover a missing var by
hitting a runtime error.

## Running locally

```bash
vercel dev
```

Not `next dev` directly — this project uses Vercel-specific primitives (Edge
Config, Blob, Sandbox, Workflows, Connect) that `next dev` alone won't wire up
correctly. `vercel dev` proxies these against your linked project's real
(development-scoped) resources.

## Git worktree workflow — this repo is built with parallel agents

Multiple agents may be working different areas of this codebase concurrently,
each in its own worktree, each on its own branch. The point of worktrees here
isn't just convenience — it's that Sandbox/Workflow/DB-touching work and pure
UI work can genuinely proceed in parallel without one agent's half-finished
`node_modules` or build state stepping on another's.

```bash
# From the main repo directory:
git worktree add ../arena-<area> -b <area>/<short-description>
cd ../arena-<area>
# work, commit, push, open a PR — same as any branch
```

Suggested worktree split, matching `docs/ROADMAP.md`'s phases so ownership
boundaries are clean:

- **`schema/`** — Postgres migrations, `docs/DATA_MODEL.md`-driven. Touches
  `db/` only.
- **`workflow/`** — the actual Workflow + Sandbox execution logic. Touches
  `lib/workflow/` only. This one should land *before* the UI worktrees have
  much to render against real data — see ROADMAP ordering.
- **`api/`** — route handlers under `app/api/`. Depends on `schema/` landing
  first for the DB shape to exist against.
- **`ui/`** — the public site (leaderboard, challenge views). Can start against
  mocked API responses before `api/` fully lands, then switch over.
- **`ops/`** — Cron, Flags wiring, Firewall rule config, Connect/Discord
  integration, OG image generation. Mostly independent of the others once
  `schema/` exists.

Merge order matters: `schema/` first, then `workflow/` and `api/` can proceed
in parallel (they both depend on schema but not on each other directly —
`api/` reads what `workflow/` writes, but through the DB, not a direct import),
then `ui/` and `ops/` land last, against a stable API surface.

When a worktree's work is ready, open a PR against the default branch as
normal — worktrees don't change the review/merge process, they're just how
multiple agents avoid stepping on each other's working directory at the same
time.

## Validation before every commit

```bash
pnpm lint
pnpm typecheck
pnpm test        # once a test suite exists — see ROADMAP, this isn't day-one
vercel build     # catches Vercel-specific build issues next/local build won't
```

A red pipeline here costs whoever reviews the PR more than it costs you to
catch it first.

## Deploying

Preview deployments happen automatically on push (standard Vercel Git
integration — confirm this is connected during `M0`, see ROADMAP). **Production
deploys are a manual, human decision** — merge to the default branch triggers a
production deploy per standard Vercel behavior; nothing in this repo's CI
should attempt to promote or auto-merge to that branch on an agent's own
authority.
