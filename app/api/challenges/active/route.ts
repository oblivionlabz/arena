// GET /api/challenges/active — docs/API.md, "current challenge" live view.
// Short-poll target: Edge Config pointer + one light Postgres status query.
// No Blob reads, no test cases, no prompt — that's docs/API.md's [slug] route.
import { getAll } from "@vercel/edge-config";
import { eq } from "drizzle-orm";

import { challenges, models, runs } from "@/db/schema";
import { db } from "@/lib/db";

export const dynamic = "force-dynamic";

const NO_STORE = { "cache-control": "no-store" };

export async function GET() {
  // One getAll() rather than three get() calls — Edge Config bills per read and
  // this endpoint is polled (docs/DATA_MODEL.md's 100-writes/100K-reads budget).
  const config = await getAll();
  const activeChallengeId =
    typeof config?.active_challenge_id === "string" ? config.active_challenge_id : null;
  const rotationLocked = config?.rotation_locked === true;
  const activeChallengeStartedAt =
    typeof config?.active_challenge_started_at === "string"
      ? config.active_challenge_started_at
      : null;

  if (!activeChallengeId) {
    return Response.json(
      { active: false, challenge: null, runs: [], rotationLocked },
      { headers: NO_STORE },
    );
  }

  const rows = await db()
    .select({
      id: challenges.id,
      slug: challenges.slug,
      title: challenges.title,
      language: challenges.language,
      status: challenges.status,
      activatedAt: challenges.activatedAt,
      completedAt: challenges.completedAt,
      runId: runs.id,
      runStatus: runs.status,
      attemptsUsed: runs.attemptsUsed,
      maxAttempts: runs.maxAttempts,
      timeToSolveMs: runs.timeToSolveMs,
      startedAt: runs.startedAt,
      finishedAt: runs.finishedAt,
      modelSlug: models.slug,
      modelDisplayName: models.displayName,
    })
    .from(challenges)
    .leftJoin(runs, eq(runs.challengeId, challenges.id))
    .leftJoin(models, eq(models.id, runs.modelId))
    .where(eq(challenges.id, activeChallengeId));

  if (rows.length === 0) {
    return Response.json(
      {
        error: `Edge Config's active_challenge_id (${activeChallengeId}) has no matching challenges row.`,
      },
      { status: 500, headers: NO_STORE },
    );
  }

  const [challenge] = rows;

  return Response.json(
    {
      active: true,
      challenge: {
        id: challenge.id,
        slug: challenge.slug,
        title: challenge.title,
        language: challenge.language,
        status: challenge.status,
        activatedAt: challenge.activatedAt,
        completedAt: challenge.completedAt,
        startedAt: activeChallengeStartedAt,
      },
      runs: rows
        .filter((row) => row.runId !== null)
        .map((row) => ({
          id: row.runId,
          model: { slug: row.modelSlug, displayName: row.modelDisplayName },
          status: row.runStatus,
          attemptsUsed: row.attemptsUsed,
          maxAttempts: row.maxAttempts,
          timeToSolveMs: row.timeToSolveMs,
          startedAt: row.startedAt,
          finishedAt: row.finishedAt,
        })),
      rotationLocked,
    },
    { headers: NO_STORE },
  );
}
