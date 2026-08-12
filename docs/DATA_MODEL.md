# Data Model

Three stores. Each one holds a different *shape* of data on purpose — see
`docs/ARCHITECTURE.md` for why the split exists at all. This file is what's
actually in each one.

## Neon Postgres — the system of record

```sql
-- A challenge, once approved and (maybe) run.
create table challenges (
  id            uuid primary key default gen_random_uuid(),
  slug          text unique not null,
  title         text not null,
  prompt        text not null,           -- the exact text sent to every model
  test_cases    jsonb not null,          -- [{input, expected_output}, ...]
  language      text not null default 'python',
  status        text not null default 'pending', -- pending | approved | rejected | active | completed
  submitted_by  text,                    -- free-text handle, no auth in v1
  created_at    timestamptz not null default now(),
  activated_at  timestamptz,
  completed_at  timestamptz
);

-- One model's config: which provider/model string, whether it's in rotation.
create table models (
  id            uuid primary key default gen_random_uuid(),
  slug          text unique not null,     -- e.g. "claude-sonnet-5"
  gateway_model text not null,            -- the exact AI Gateway model identifier
  display_name  text not null,
  active        boolean not null default true, -- also mirrored to a Flag, see below
  created_at    timestamptz not null default now()
);

-- One model's attempt at one challenge. This is the row a leaderboard query aggregates.
create table runs (
  id              uuid primary key default gen_random_uuid(),
  challenge_id    uuid not null references challenges(id),
  model_id        uuid not null references models(id),
  status          text not null default 'queued', -- queued | running | passed | failed | error
  attempts_used   int not null default 0,
  max_attempts    int not null default 3,
  time_to_solve_ms int,                    -- null until passed
  blob_key        text,                    -- pointer into Blob, see below — not the content itself
  started_at      timestamptz,
  finished_at     timestamptz,
  workflow_run_id text                     -- correlates back to the Workflows run for tracing
);

create index runs_challenge_idx on runs(challenge_id);
create index runs_model_idx on runs(model_id);
```

Leaderboard queries (win rate, average time-to-solve, streaks) are read against
`runs` joined to `models`/`challenges` — real SQL, not application-layer
aggregation. This table is why Postgres exists at all in this stack; nothing
here would be pleasant in a pure KV store.

## Edge Config — current state only

A single JSON document, small, read on nearly every request:

```json
{
  "active_challenge_id": "uuid-of-current-challenge",
  "active_challenge_started_at": "2026-08-13T00:00:00Z",
  "rotation_locked": false
}
```

Written exactly once a day, by the Cron-triggered rotation step. Everything
else about "what's active right now" — the actual prompt, test cases, per-model
run status — is looked up from Postgres using the ID this document points to.
Edge Config is a pointer, not a cache of the record itself; keep it that way,
the 100-writes/month budget doesn't survive if this becomes a second copy of
`challenges`.

## Vercel Blob — write-once artifacts

Key convention: `runs/{run_id}/attempt-{n}.json`, one blob per attempt, each
containing:

```json
{
  "run_id": "uuid",
  "attempt": 1,
  "submitted_code": "...",
  "execution_stdout": "...",
  "execution_stderr": "...",
  "test_results": [{ "case": 0, "passed": true }, ...],
  "sandbox_duration_ms": 842
}
```

`runs.blob_key` in Postgres points at the *final* attempt's blob (the one that
either passed or exhausted retries) — intermediate failed-attempt blobs stay
in Blob storage for the execution-log view but aren't referenced from the main
table, only fetched when a visitor expands "show all attempts" on a run detail
page.

**Hard rule, not a suggestion:** a blob is written exactly once, when an attempt
finishes. Nothing polls Blob. Nothing rewrites a key in a loop. If a future
change wants "live" attempt output streaming, that's a different mechanism
(stream the Sandbox's stdout directly to the client while the Workflow step is
running, then write the final blob once at the end) — not a workaround that
turns this into a repeated-write pattern. See `docs/SECURITY.md` for exactly
what happens on this account if that rule gets broken.
