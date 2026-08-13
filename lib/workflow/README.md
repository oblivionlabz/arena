# lib/workflow/

The Benchmark Workflow implementation — `benchmarkChallenge()` and
`attemptModel()` per `docs/WORKFLOWS.md`. Implement against that state machine
document exactly; it's not a rough sketch, it's the spec. Owned by the
`workflow/` worktree.

## Layout

| File | Role |
| --- | --- |
| `benchmark.ts` | The two `"use workflow"` functions. Orchestration only. |
| `steps/model.ts` | `callModel` — one AI Gateway call. |
| `steps/sandbox.ts` | `runInSandbox` — one Sandbox per attempt, torn down after. |
| `steps/blob.ts` | `writeAttemptBlob` — the only Blob write in the system. |
| `steps/db.ts` | Postgres reads/writes against `db/schema.ts`. |
| `config.ts` | The execution limits `docs/SECURITY.md` requires. |
| `db.ts` | Drizzle `neon-http` client, one per step invocation. |

Everything that touches the network, the filesystem, or the database lives in a
`"use step"` function. The workflow functions only stitch steps together — they
run in a sandboxed VM without Node.js access, so logic that belongs in a step
will fail there.

## Triggering a run

```ts
import { start } from "workflow/api";
import { benchmarkChallenge } from "@/lib/workflow";

await start(benchmarkChallenge, [challengeId]);
```

The Cron route that calls this on a schedule is M3, owned by `ops/`.

Seed a challenge and a model to run against first — see `db/README.md`.

## Inspecting a run

```bash
npx workflow inspect runs
npx workflow inspect run <run_id> --backend vercel --project arena
```

`runs.workflow_run_id` is the join key from a leaderboard row back to the
Workflow run that produced it.
