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

**Not yet built** — the challenge-detail page currently shows run summaries
only (status, attempts, time-to-solve), not the per-attempt code/log detail
this route is meant to serve. Noted here rather than silently left inaccurate;
picking this up is a `ui/`-plus-`api/` pairing, not `ops/`'s to build
unilaterally.

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

**Decided (M4, `ops/`):** a shared secret header (`INTERNAL_TOKEN`), compared
with `crypto.timingSafeEqual` against a fixed-length hash of both sides (see
`lib/internal/auth.ts`) — not Vercel deployment protection. Deployment
protection on this project is already fully spent on the M2 exit criteria
(SSO must stay off `arena-phi-three.vercel.app` so the public site is
reachable at all); Hobby has no path-prefix-only protection mode to layer a
second policy under that without touching the whole project's setting, so a
header check on the route itself is what doesn't depend on account-level
config this project doesn't have.

### `POST /api/internal/challenges/[id]/moderate`

Called by: the operator, approving or rejecting a `pending` challenge.
Transitions `pending → approved` (also writing the real `test_cases` — a
public submission always arrives with `test_cases: []`, per the submit
route's own comment; approving without supplying real cases would produce a
challenge the Workflow can't run) or `pending → rejected`. Only `approved`
challenges are eligible for rotation. 409s if the challenge isn't currently
`pending`.

### `GET /api/internal/challenges/pending`

Called by: `/internal/moderate`, the operator moderation page. Not originally
listed in this document — added alongside the moderate route above, because
nothing else exposes a pending challenge's id (pending rows are invisible
everywhere public, on purpose) and the moderate route is unusable without a
way to discover what's waiting.

## Cron-only routes

### `POST /api/cron/rotate-challenge`

Called by: Vercel Cron, once daily, per `vercel.json`. Verifies
`Authorization: Bearer $CRON_SECRET` — sent automatically by Vercel Cron once
`CRON_SECRET` is set as a project env var (M3, `ops/`, confirmed against
current Vercel Cron docs, not assumed). Performs the selection + Postgres
update + Edge Config write + Workflow trigger described in
`docs/WORKFLOWS.md`, honoring the `pausedModelSlugs` and `chaosMode` Flags
(`flags.ts`) before starting the cycle.

## Outbound calls (not inbound routes)

Not HTTP routes this app exposes — calls the Workflow makes at the end of a
completed cycle, listed here because they're part of the same request-flow
picture:

- **Discord digest post** — fired from `postDigest()`
  (`lib/workflow/steps/digest.ts`), once per completed challenge. **Not
  Connect-mediated** — Vercel Connect's connector types
  (`api-key, github, linear, oauth, photon, salesforce, slack, snowflake`,
  confirmed against the live product during M3) don't include Discord, so
  there's no connector to request a short-lived token from. Uses a Discord
  Incoming Webhook URL (`DISCORD_WEBHOOK_URL`) instead — see
  `lib/ops/discord.ts` for why that's an acceptable substitute per
  `docs/SECURITY.md`'s standing-credential concern.
- **GitHub PR (optional, later phase)** — opens a PR with the winning
  submission's code. GitHub *is* a real Connect connector type, so this one
  can use `@vercel/connect` as originally planned when it's built. Not in
  v1's critical path — see `docs/ROADMAP.md`.
