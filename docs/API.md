# API

Next.js route handlers under `app/api/`. Every route below states who calls it —
that's load-bearing: the public/internal split determines whether Firewall
rate-limiting and input validation are mandatory (public) or just good practice
(internal/cron-only).

## Public routes

### `GET /api/leaderboard`

Called by: the public leaderboard page, at ISR revalidation time — **not** by
client-side fetches on every page view. If the page ever grows a "refresh live"
button, that still hits ISR-cached output unless explicitly bypassed; don't
let this become a raw per-visitor DB hit.

Returns: per-model aggregate stats (win rate, avg time-to-solve, current
streak), computed from `runs`/`models`.

### `GET /api/challenges/[slug]`

Called by: the challenge-detail page. Returns the challenge prompt, test case
*count* (not the raw test cases — see `docs/SECURITY.md` on not leaking test
cases while a challenge is still active), and every model's run summary for it.

### `GET /api/challenges/[slug]/runs/[run_id]`

Called by: the "expand attempt detail" UI. Returns the full per-attempt Blob
content (code, stdout/stderr, test results) for one run. Only serves this for
`completed` challenges — an in-progress challenge's code must not be
retrievable this way, that would let a later model in the same rotation see an
earlier competitor's attempt.

### `GET /api/challenges/active`

Called by: the "current challenge" live view. Short-poll target (client polls
this on a multi-second interval while a challenge is `active`, stops once it's
`completed`) — cheap because this reads Edge Config's pointer plus a light
Postgres status query, not Blob contents. This is the deliberate alternative to
a websocket mentioned in `docs/ARCHITECTURE.md`.

### `POST /api/challenges/submit`

Called by: the public "submit a challenge idea" form. **This is the one public
write endpoint and the one that gets a Firewall rule.** Validates and inserts
a `challenges` row with `status = 'pending'` — never `approved`, never
`active`. No path from this endpoint reaches code execution. See
`docs/SECURITY.md`.

## Internal / operator routes

Gate these behind a shared secret header (`INTERNAL_TOKEN`, checked with the
same `timingSafeEqual` pattern used elsewhere in this codebase — do not
string-compare) or Vercel deployment protection on a `/api/internal/*` prefix,
decide which during `M1` and document the actual choice here once made.

### `POST /api/internal/challenges/[id]/moderate`

Called by: the operator, approving or rejecting a `pending` challenge.
Transitions `pending → approved` or `pending → rejected`. Only `approved`
challenges are eligible for rotation.

## Cron-only routes

### `POST /api/cron/rotate-challenge`

Called by: Vercel Cron, once daily, per `vercel.json`. Must verify the request
actually came from Vercel's Cron invoker (check the documented header/secret
Vercel Cron sends — confirm the exact mechanism in current docs during `M1`,
don't assume it's identical to some other project's older Cron setup).
Performs the selection + Edge Config write + Workflow trigger described in
`docs/WORKFLOWS.md`.

## Connect-mediated calls (not inbound routes)

Not HTTP routes this app exposes — outbound calls the Workflow makes through
`@vercel/connect`, listed here because they're part of the same request-flow
picture:

- **Discord digest post** — fired at the end of `benchmarkChallenge()`, once
  per completed challenge. Short-lived token requested at call time, per
  `docs/ARCHITECTURE.md`.
- **GitHub PR (optional, later phase)** — opens a PR with the winning
  submission's code. Same token-scoping rule. Not in v1's critical path —
  see `docs/ROADMAP.md`.
