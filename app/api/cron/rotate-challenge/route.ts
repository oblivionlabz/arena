// POST /api/cron/rotate-challenge — docs/WORKFLOWS.md's Trigger, the daily
// entry point into the benchmark cycle. `vercel.json` schedules this at
// 00:00 UTC; this file is what makes that actually do something instead of
// 404ing. Fires the Workflow and returns immediately — the race itself runs
// independently, durable, outside this request's lifetime.
import { and, asc, eq } from "drizzle-orm";
import { start } from "workflow/api";

import { challenges } from "@/db/schema";
import { db } from "@/lib/db";
import { setActiveChallenge, EdgeConfigNotConfigured } from "@/lib/ops/edge-config";
import { benchmarkChallenge } from "@/lib/workflow";

export const dynamic = "force-dynamic";

const NO_STORE = { "cache-control": "no-store" };

function unauthorized() {
  return Response.json({ error: "Unauthorized." }, { status: 401, headers: NO_STORE });
}

export async function GET(request: Request) {
  // Vercel Cron invokes with GET and sends this header automatically once
  // CRON_SECRET is set as a project env var — docs/DEVELOPMENT.md's current
  // Vercel Cron docs check, done during this route's own build.
  const authHeader = request.headers.get("authorization");
  const cronSecret = process.env.CRON_SECRET;
  if (!cronSecret || authHeader !== `Bearer ${cronSecret}`) {
    return unauthorized();
  }

  const database = db();

  // A challenge still `active` means the previous cycle hasn't finished —
  // rotating over it would repoint Edge Config at a new race while models are
  // still mid-attempt on the old one. Not in docs/WORKFLOWS.md's happy path,
  // but a same-day overlap is exactly the kind of thing a degraded provider's
  // sleep()-and-retry (see docs/WORKFLOWS.md) could produce, so this is a
  // correctness check, not a hypothetical.
  const [stillRacing] = await database
    .select({ id: challenges.id, slug: challenges.slug })
    .from(challenges)
    .where(eq(challenges.status, "active"))
    .limit(1);

  if (stillRacing) {
    return Response.json(
      {
        rotated: false,
        reason: `Challenge '${stillRacing.slug}' is still active — the previous cycle hasn't completed.`,
      },
      { headers: NO_STORE },
    );
  }

  // Oldest-first among approved challenges. docs/WORKFLOWS.md leaves room for
  // an operator-pinned override later; no such column exists yet (M1 shipped
  // without one), so there's nothing to honor beyond FIFO today.
  const [next] = await database
    .select({ id: challenges.id, slug: challenges.slug })
    .from(challenges)
    .where(eq(challenges.status, "approved"))
    .orderBy(asc(challenges.createdAt))
    .limit(1);

  if (!next) {
    return Response.json(
      { rotated: false, reason: "No approved challenge is waiting in the queue." },
      { headers: NO_STORE },
    );
  }

  const startedAt = new Date();

  // Postgres first: this is the system of record, and a failed Edge Config
  // write shouldn't roll it back — the pointer is a read-optimization over
  // this row, not the other way around (docs/ARCHITECTURE.md).
  await database
    .update(challenges)
    .set({ status: "active", activatedAt: startedAt })
    .where(and(eq(challenges.id, next.id), eq(challenges.status, "approved")));

  let edgeConfigWarning: string | null = null;
  try {
    await setActiveChallenge(next.id, startedAt.toISOString());
  } catch (error) {
    // The live view falls back to Postgres-backed routes for everything
    // except this one pointer (docs/API.md) — losing the write means the
    // short-poll "current challenge" view won't find it, not that the
    // rotation itself failed. Surface it, don't block on it.
    edgeConfigWarning =
      error instanceof EdgeConfigNotConfigured
        ? error.message
        : `Edge Config write failed: ${error instanceof Error ? error.message : String(error)}`;
    console.error(`rotate-challenge: ${edgeConfigWarning}`);
  }

  // `start()` returns as soon as the run is created, not when it finishes —
  // the race itself runs independently of this request, per docs/WORKFLOWS.md
  // step 5 ("Returns immediately"). Awaiting `run.returnValue` here would
  // hold this Function open for the entire benchmark cycle instead.
  const run = await start(benchmarkChallenge, [next.id]);

  return Response.json(
    {
      rotated: true,
      challengeId: next.id,
      challengeSlug: next.slug,
      workflowRunId: run.runId,
      edgeConfigWarning,
    },
    { headers: NO_STORE },
  );
}
