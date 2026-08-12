# AGENTS.md

You are working in the Arena repository — a live, multi-model coding benchmark
built on Vercel's Hobby-tier platform (AI Gateway, Sandbox, Workflows, Blob,
Edge Config, Neon Postgres, Connect, Flags, Firewall — see
`docs/ARCHITECTURE.md`). This file is short on purpose. The real detail lives
in `docs/`, which you're expected to read, not infer:

- **`docs/PRODUCT.md`** — what this is and isn't. Read before assuming a
  feature is in scope.
- **`docs/ARCHITECTURE.md`** — the system shape and why each Vercel feature is
  used the way it is. Read before changing structure.
- **`docs/DATA_MODEL.md`** — the schema across all three stores. Read before
  touching Postgres, Edge Config, or Blob.
- **`docs/WORKFLOWS.md`** — the exact benchmark-run state machine. Implement
  against this, don't improvise the shape.
- **`docs/API.md`** — every route's contract and caller.
- **`docs/SECURITY.md`** — the threat model. **Read this before touching
  anything in the Sandbox, Workflow, or public-API paths. Not optional.**
- **`docs/DEVELOPMENT.md`** — local setup, env vars, and the git-worktree
  workflow this repo is built with.
- **`docs/ROADMAP.md`** — build phases and which worktree owns which area.
- **`docs/OPERATING_PRINCIPLES.md`** — how to think while working here:
  verify before claiming, keep changes scoped, handle errors honestly.

## This repo is built with parallel agents in git worktrees

See `docs/DEVELOPMENT.md` for the exact worktree split
(`schema/`, `workflow/`, `api/`, `ui/`, `ops/`) and merge ordering. If you're
one of several agents working this repo concurrently: stay inside your
worktree's assigned area, don't reach into files another worktree owns even if
you notice something to fix there — note it instead (a PR comment, or
`docs/ROADMAP.md`'s backlog), and let that worktree's owner handle it.

## Rules that do not bend

1. **Always work on a branch, in your assigned worktree.** Never commit
   directly to the default branch.
2. **Stay inside your assigned task's scope.** Found an unrelated bug? Note it,
   don't fix it in the same change. Scope creep is the hardest thing for a
   reviewer to catch because it's mixed in with what was actually asked for.
3. **Run validation before every commit** — `docs/DEVELOPMENT.md` has the exact
   commands (`lint`, `typecheck`, `vercel build`, and `test` once a suite
   exists). A red pipeline someone else catches costs more than one you catch
   yourself.
4. **Never deploy to production, and never merge your own PR.** Production is
   a human decision with a manual gate. Open the PR, describe what changed and
   how you validated it, then stop.
5. **Never bypass CI or a failing gate.** No `--no-verify`, no force-push over
   a failed run. If a gate is wrong, say so in the PR and leave it failing —
   don't route around it.
6. **Never put a secret where `docs/SECURITY.md` says it doesn't belong** —
   most importantly, nothing goes into a Sandbox execution environment beyond
   what a test harness strictly needs, and Discord/GitHub access goes through
   Connect's short-lived tokens, never a long-lived credential in an env var.
7. **Never let the Sandbox trust boundary get thinner "for efficiency."** One
   Sandbox per attempt, torn down after, no reuse across attempts or models.
   If a change seems to require relaxing this, that's a `docs/SECURITY.md`
   conversation first, not a code change to make unilaterally.
8. **Never turn a write-once Blob pattern into a polling loop.** See
   `docs/DATA_MODEL.md` and `docs/SECURITY.md` for exactly why this is a hard
   rule and not a style preference — it's the difference between staying
   inside Vercel's free-tier operation quota and getting the store suspended
   platform-side with no clear error message.

## Finishing a task

Open a pull request against the default branch. State what changed, why, how
you validated it, and anything you deliberately left alone. Then stop.

If you can't finish, say so plainly and leave the branch in a state the next
agent or a human can pick up cleanly. A partial, honest change is useful. A
change that claims to work and doesn't is worse than nothing — especially here,
where the entire product exists to prove that results are verified, not
asserted.
