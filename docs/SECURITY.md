# Security

This project's entire premise is executing AI-generated code from a public
website. Treat that sentence as the threat model's headline, not a footnote.
Read this before touching anything in the Sandbox, Workflow, or public-API
paths.

## Trust boundaries

```
UNTRUSTED                          TRUSTED
──────────                         ───────
Public visitor input      ──►     Postgres row (status='pending')
(challenge submission)             (never reaches execution)

LLM-generated code         ──►    Vercel Sandbox              ──► Blob (result only)
(from an approved                 (isolated, torn down             (never the sandbox
 challenge prompt)                 after every attempt)              itself, persisted)
```

Two separate untrusted inputs exist and must never be conflated:

1. **Visitor-submitted challenge text** (the `POST /api/challenges/submit` body).
   This is a string that becomes a *prompt sent to an LLM later*, after human
   moderation. It never becomes code that executes. Treat it as you would any
   public-form text: length-capped, stored as data, never interpolated into
   anything that gets `eval`'d, shelled out, or templated into a system prompt
   in a way that could override the benchmark instructions (basic prompt-
   injection hygiene — the moderation step is a human checkpoint specifically
   because this input is adversarial by default).

2. **LLM-generated code** (the actual output of `callModel()` in the Workflow).
   This is what runs in the Sandbox. It is adversarial by default too — models
   sometimes produce code that tries to read environment variables, make
   network calls, or exhaust resources, not necessarily out of malice but
   because "solve this however you can" is exactly what was asked. The Sandbox
   is the only thing standing between this code and everything else.

## Sandbox isolation rules

- **One Sandbox per attempt. Never reused across attempts or models.** A fresh
  microVM per execution means a compromised or resource-exhausting attempt
  can't affect the next one, full stop — don't optimize this into a shared
  pool "for efficiency" without re-deriving this section's guarantees from
  scratch first.
- **No secrets in the Sandbox environment.** The Sandbox execution environment
  gets nothing beyond what the challenge's test harness strictly requires
  (stdin/args for the test cases). It never receives `DATABASE_URL`,
  `INGEST_TOKEN`-equivalents, Gateway keys, or Connect credentials. If a
  future challenge type genuinely needs the sandboxed code to call an external
  API, that's a design conversation, not a default.
- **Bounded execution time and resources per attempt**, independent of and
  tighter than the Workflow step's own timeout — a runaway script should hit
  the Sandbox's own limit before it ever threatens the surrounding
  infrastructure's. Set explicit CPU/memory/wall-clock caps per execution;
  don't rely on Hobby's account-wide Sandbox quota (5 Active-CPU-hrs/month) as
  the only backstop, that's a budget limit, not a per-run safety limit.
- **No outbound network from inside the Sandbox** unless a specific challenge
  type is explicitly designed to need it (none are, in v1). Default-closed,
  not default-open-then-audited.

## Public-endpoint hardening

- `POST /api/challenges/submit` is the only public write path and gets one of
  the account's three Hobby-tier Firewall custom rules — rate-limited per
  IP/session. This budget is small on purpose (three rules total); don't spend
  a second one speculatively before there's a real second threat to name.
- Input validation on that endpoint: length caps on every field, no HTML/markup
  trusted or rendered unescaped anywhere it's later displayed (the challenge
  title/prompt do get displayed publicly once approved — sanitize on write,
  not just on the way out).
- Internal/operator routes (`docs/API.md`) check their shared secret with a
  constant-time comparison. A plain `===`/string-equality check on a secret
  token is a timing side-channel; don't introduce one just because the stakes
  feel low for an admin-only moderation endpoint.

## Test-case confidentiality while a challenge is active

`GET /api/challenges/[slug]` must not return the actual `test_cases` content —
only a count — while `status = 'active'`. Once `status = 'completed'`, exposing
them is fine (arguably good, for transparency). This isn't a hard security
boundary in the traditional sense, but it's the difference between "the
benchmark is a real race" and "the last model to run had an advantage because
someone leaked the test cases by hitting the wrong endpoint" — treat it as a
correctness requirement enforced at the API layer, not just a UI omission.

## Credentials — Connect over long-lived secrets

Discord and (later) GitHub access go through `@vercel/connect`, requesting a
short-lived, scoped token at call time — never a standing bot token or PAT
sitting in an environment variable. This isn't a stylistic preference. The
reasoning, concretely: this project's core function is running code an LLM
wrote, in production, continuously. Anything with a long-lived credential
sitting in that same execution environment is one confused-deployment or
misconfigured-scope away from being reachable by something it shouldn't be.
Connect's whole value here is that even a total compromise of the app's own
runtime doesn't hand over a durable Discord/GitHub credential — there isn't
one sitting there to steal.

## The Blob write-once rule is a security control, not just a cost control

`docs/DATA_MODEL.md` states Blob is written exactly once per attempt, never
polled or rewritten in a loop. The reason this belongs in the security doc too:
this project's own operator hit a live incident, the same day this system was
designed, where a *different* project's 30-second polling write against Vercel
Blob silently exhausted the entire Hobby-tier monthly operation quota and got
the store suspended by the platform — with the only visible symptom being a
generic `500` on every subsequent request. A resource-exhaustion bug that
presents as an opaque platform-level lockout, discovered days or weeks later,
is a real failure mode here, not a hypothetical. Enforce the write-once
discipline at code review, not just documentation.

## What "done" looks like for a security review of a new feature

Before merging anything that touches the Sandbox, the public submission
endpoint, or credential handling: can you point at the specific line that
enforces isolation/rate-limiting/timing-safety for what you just added? "It
should be fine" is not a review outcome on this codebase.
