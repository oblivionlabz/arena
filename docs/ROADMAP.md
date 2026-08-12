# Roadmap

Phased so each phase is ownable by one worktree/agent per
`docs/DEVELOPMENT.md`'s split, with explicit dependency ordering so parallel
work doesn't stall waiting on itself.

## M0 — Scaffold (no worktree split needed, do this first, serially)

- Next.js app initialized, `vercel link`ed, deploys successfully with a static
  placeholder page.
- Neon Postgres provisioned via Marketplace, `docs/DATA_MODEL.md`'s schema
  applied as an initial migration.
- Edge Config store created, empty document matching the shape in
  `docs/DATA_MODEL.md`.
- Blob store created.
- AI Gateway enabled on the project, one model configured end-to-end as a
  smoke test (a single hardcoded prompt → response, nothing else wired up yet).
- `.env.example` fully accurate against what `M0` actually required.
- CI running lint/typecheck on PRs (even against an otherwise-empty app).

**Exit criteria:** a human can `vercel link && vercel env pull && vercel dev`
on a fresh clone and get a running placeholder app with a working DB
connection. This is the foundation every worktree in M1 branches from.

## M1 — Core race loop (worktree split begins here)

- `schema/`: migrations finalized against real usage (M0's schema was a first
  draft — expect adjustments once `workflow/` and `api/` are actually built
  against it).
- `workflow/`: `benchmarkChallenge()` and `attemptModel()` implemented per
  `docs/WORKFLOWS.md`, against Sandbox + AI Gateway, writing real `runs` rows
  and Blob attempts. Testable in isolation by triggering a Workflow run
  directly (not yet via Cron) against a seeded challenge.
- `api/`: `GET /api/challenges/active`, `GET /api/leaderboard`,
  `GET /api/challenges/[slug]` implemented against real data once `schema/`
  and `workflow/` have something to read.

**Exit criteria:** manually triggering a benchmark run against one seeded
challenge produces real, verifiable `runs` rows and Blob content — end to end,
no UI needed yet to confirm this works.

## M2 — Public site

- `ui/`: leaderboard page (ISR), challenge-detail page, live "active challenge"
  view (the short-poll pattern from `docs/API.md`). Can start against mocked
  API shapes before `M1`'s `api/` fully lands, then switch to real endpoints.
- `POST /api/challenges/submit` + the public submission form, with Firewall
  rate-limiting wired per `docs/SECURITY.md` from the start — not added later
  as a follow-up.

**Exit criteria:** a visitor with no special access can see a live challenge
resolve, browse the leaderboard, and submit a challenge idea. Note from `M0`:
the Vercel project has standard SSO Deployment Protection on by default
(`all_except_custom_domains`), correct while there's no public-facing content
yet — but it must be turned off for the production domain (or a custom domain
attached, which bypasses it) before this exit criteria is actually true,
otherwise every visitor hits a Vercel login wall instead of the site.

## M3 — Automation and distribution

- `ops/`: Cron rotation wired to actually trigger `M1`'s Workflow on schedule
  (previously only manually triggered).
- OG image generation for completed challenges.
- Connect + Discord digest post, triggered at the end of a completed
  benchmark cycle.
- Flags wired for model rotation and chaos-mode toggles.

**Exit criteria:** a full cycle — Cron fires, challenge rotates, models race,
leaderboard updates, Discord gets the digest — happens with zero manual steps,
matching `docs/PRODUCT.md`'s success criteria.

## M4 — Polish and observability

- OTel tracing wired end-to-end (`docs/WORKFLOWS.md`'s observability hook) —
  should already exist in some form by now from `M1`, this phase is about
  making it actually useful for debugging, not introducing it fresh.
- Operator moderation UI/route for pending challenges (`docs/API.md`'s
  internal route), if not already built as part of `M2`.
- Web Analytics + Speed Insights confirmed reporting correctly.

## Backlog (explicitly not scheduled — v1 scope per `docs/PRODUCT.md`)

- Additional languages beyond the first Sandbox template.
- GitHub PR-opening for winning solutions (mentioned in `docs/API.md` as a
  later phase — not required for M3's "zero manual steps" criteria).
- Any move beyond Hobby-plan limits. Don't pre-build around Pro-tier
  capacity; that's a real decision to make later with real usage data, not
  something to design in speculatively now.
