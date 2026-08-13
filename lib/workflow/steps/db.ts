import { and, eq, sql } from "drizzle-orm";

import { challenges, models, runs } from "@/db/schema";
import { getDb } from "@/lib/workflow/db";
import { testCasesSchema } from "@/lib/workflow/types";
import type { ChallengeSpec, ModelSpec } from "@/lib/workflow/types";

export async function loadChallenge(challengeId: string): Promise<ChallengeSpec> {
  "use step";

  const db = getDb();
  const [row] = await db
    .select({
      id: challenges.id,
      slug: challenges.slug,
      prompt: challenges.prompt,
      language: challenges.language,
      testCases: challenges.testCases,
    })
    .from(challenges)
    .where(eq(challenges.id, challengeId))
    .limit(1);

  if (!row) {
    throw new Error(`challenge ${challengeId} not found`);
  }

  return { ...row, testCases: testCasesSchema.parse(row.testCases) };
}

export async function loadActiveModels(): Promise<ModelSpec[]> {
  "use step";

  const db = getDb();
  return db
    .select({
      id: models.id,
      slug: models.slug,
      gatewayModel: models.gatewayModel,
      displayName: models.displayName,
    })
    .from(models)
    .where(eq(models.active, true))
    .orderBy(models.slug);
}

/**
 * Creates the `runs` row for one model's branch, or adopts the existing one.
 *
 * The uniqueness guard is on (challenge_id, model_id, workflow_run_id): a step
 * can be replayed after its write already landed, and a second row would
 * double-count that model in every leaderboard aggregate.
 */
export async function createRun(
  challengeId: string,
  modelId: string,
  workflowRunId: string,
): Promise<{ runId: string; maxAttempts: number }> {
  "use step";

  const db = getDb();
  const [existing] = await db
    .select({ runId: runs.id, maxAttempts: runs.maxAttempts })
    .from(runs)
    .where(
      and(
        eq(runs.challengeId, challengeId),
        eq(runs.modelId, modelId),
        eq(runs.workflowRunId, workflowRunId),
      ),
    )
    .limit(1);

  if (existing) return existing;

  const [created] = await db
    .insert(runs)
    .values({
      challengeId,
      modelId,
      workflowRunId,
      status: "running",
      startedAt: sql`now()`,
    })
    .returning({ runId: runs.id, maxAttempts: runs.maxAttempts });

  return created;
}

export async function finalizeRun(
  runId: string,
  status: "passed" | "failed" | "error",
  attemptsUsed: number,
  blobKey: string | null,
): Promise<void> {
  "use step";

  const db = getDb();
  await db
    .update(runs)
    .set({
      status,
      attemptsUsed,
      blobKey,
      finishedAt: sql`now()`,
      // Measured from the row's own started_at rather than the workflow's
      // logical clock, so a replayed branch can't inflate the reported time.
      timeToSolveMs:
        status === "passed"
          ? sql`(extract(epoch from (now() - ${runs.startedAt})) * 1000)::int`
          : null,
    })
    .where(eq(runs.id, runId));
}

export async function completeChallenge(challengeId: string): Promise<void> {
  "use step";

  const db = getDb();
  await db
    .update(challenges)
    .set({ status: "completed", completedAt: sql`now()` })
    .where(eq(challenges.id, challengeId));
}
