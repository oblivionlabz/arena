# Workflows

The benchmark cycle is one Vercel Workflow run, fanned out into one branch per
active model. This document is the actual state machine — implement against
this, don't improvise the shape.

## Trigger

Daily Cron hits `POST /api/cron/rotate-challenge` (see `docs/API.md`). That
handler:

1. Picks the next `approved` challenge (oldest first, or operator-pinned —
   decide the exact selection rule during `M1`, not a Workflows concern).
2. Writes the new `active_challenge_id` to Edge Config.
3. Updates the challenge row's `status` to `active`, `activated_at = now()`.
4. Starts the Benchmark Workflow, passing `challenge_id`.
5. Returns immediately — the Workflow runs independently of this request.

## Workflow: `benchmarkChallenge(challenge_id)`

```
'use workflow'

1. Load challenge (prompt, test_cases, language) from Postgres.
2. Load active models from Postgres (models.active = true).
3. Fan out: for each active model, start attemptModel(challenge, model) as a
   parallel step. Do not await them sequentially — they must run concurrently,
   that's the whole point of a "race."
4. Wait for all attemptModel() branches to settle (pass, fail, or error —
   never let one hung branch block the others; each branch has its own
   internal timeout, see below).
5. Once all branches are settled:
   a. Update challenge.status = 'completed', completed_at = now().
   b. Generate the OG scorecard image (see docs/ARCHITECTURE.md).
   c. Trigger the Discord digest step via Connect.
6. End.
```

## Step: `attemptModel(challenge, model)`

This is the per-model branch. Runs as its own durable step sequence so one
model's retries don't block another model's run.

```
'use workflow'

attempt = 1
max_attempts = 3   -- from runs.max_attempts, configurable per-challenge later if needed

create `runs` row: status = 'running', started_at = now()

loop:
  1. 'use step' — callModel(model, challenge.prompt, priorFailureContext)
     → calls AI Gateway, gets back generated code.
     → on provider error/timeout: record as this attempt's failure reason,
       do not silently retry inside this step — surface it to the loop below
       so attempt-count bookkeeping stays honest.

  2. 'use step' — runInSandbox(challenge.language, generated_code, challenge.test_cases)
     → creates a fresh Vercel Sandbox (never reuse one across attempts or models —
       see docs/SECURITY.md), executes the code against every test case,
       tears the sandbox down, returns { passed: bool, per_case_results, stdout, stderr }.
     → this step has its own hard timeout (see docs/SECURITY.md's resource
       limits) independent of the Workflow's own step timeout, so a runaway
       submission can't hold a sandbox open indefinitely.

  3. 'use step' — writeAttemptBlob(run_id, attempt, generated_code, sandbox_result)
     → one Blob write. See docs/DATA_MODEL.md — this is the ONLY place in the
       whole system that writes to Blob, and it writes exactly once per
       attempt, never in a loop of its own.

  4. if sandbox_result.passed:
       update `runs`: status = 'passed', attempts_used = attempt,
         time_to_solve_ms = (now - started_at), blob_key = this attempt's key
       return

  5. if attempt >= max_attempts:
       update `runs`: status = 'failed', attempts_used = attempt,
         blob_key = this (final, failing) attempt's key
       return

  6. attempt += 1
     priorFailureContext = summarize(sandbox_result)  -- fed back into the next
       callModel() call, this is the "self-critique" loop
     continue
```

## Why `sleep()` exists here even though nothing in v1 obviously needs it

A provider can be slow or degraded. Rather than holding a Workflow step open
(and burning against Hobby's 300s Function ceiling) waiting on a hung provider
call, `callModel()` should be written to fail fast on a bounded timeout and let
the *Workflow* — not the Function — own any "wait and retry later" behavior via
`sleep()`. This is a durability property, not a feature: if this project ever
needs "give a slow provider a few extra minutes without tying up compute," the
mechanism already exists, it just isn't exercised by v1's happy path. Don't
build a separate retry-with-backoff library for this — it's what Workflows is
for.

## Observability hook

Every step above should be wrapped so its Workflow run ID lands in
`runs.workflow_run_id` (see `docs/DATA_MODEL.md`) — that's the join key between
"what the leaderboard shows" and "what actually happened," traceable via
`vercel traces get` against the OTel span. Do not skip wiring this in `M1`
just because it doesn't show up in the UI; debugging a stuck or wrong-scoring
run without it means reconstructing the story from Blob contents by hand.
