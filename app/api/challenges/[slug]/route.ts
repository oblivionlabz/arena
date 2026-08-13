// GET /api/challenges/[slug] — docs/API.md, the challenge-detail page.
import { and, eq, inArray, sql } from "drizzle-orm";

import { challenges, models, runs } from "@/db/schema";
import { db } from "@/lib/db";

// `pending` and `rejected` rows come straight from the anonymous submission form
// (docs/API.md, POST /api/challenges/submit) and have not passed the operator
// moderation checkpoint docs/SECURITY.md relies on. They are invisible here —
// 404, not 403, so this doesn't confirm whether such a slug exists.
const PUBLICLY_VISIBLE_STATUSES = ["approved", "active", "completed"];

export async function GET(_request: Request, { params }: { params: Promise<{ slug: string }> }) {
  const { slug } = await params;

  const [challenge] = await db()
    .select({
      id: challenges.id,
      slug: challenges.slug,
      title: challenges.title,
      prompt: challenges.prompt,
      language: challenges.language,
      status: challenges.status,
      submittedBy: challenges.submittedBy,
      createdAt: challenges.createdAt,
      activatedAt: challenges.activatedAt,
      completedAt: challenges.completedAt,
      testCaseCount: sql<number>`jsonb_array_length(${challenges.testCases})`,
      // docs/SECURITY.md, "Test-case confidentiality while a challenge is active":
      // the content is withheld until the challenge is completed. Enforced here,
      // in the projection, so no later refactor of the response shape can leak it.
      testCases: sql<
        unknown[] | null
      >`case when ${challenges.status} = 'completed' then ${challenges.testCases} else null end`,
    })
    .from(challenges)
    .where(
      and(
        eq(challenges.slug, slug),
        inArray(challenges.status, PUBLICLY_VISIBLE_STATUSES),
      ),
    )
    .limit(1);

  if (!challenge) {
    return Response.json({ error: `No challenge with slug '${slug}'.` }, { status: 404 });
  }

  const runSummaries = await db()
    .select({
      id: runs.id,
      model: { slug: models.slug, displayName: models.displayName, active: models.active },
      status: runs.status,
      attemptsUsed: runs.attemptsUsed,
      maxAttempts: runs.maxAttempts,
      timeToSolveMs: runs.timeToSolveMs,
      startedAt: runs.startedAt,
      finishedAt: runs.finishedAt,
    })
    .from(runs)
    .innerJoin(models, eq(models.id, runs.modelId))
    .where(eq(runs.challengeId, challenge.id))
    .orderBy(models.displayName);

  return Response.json(
    { challenge, runs: runSummaries },
    {
      // docs/ARCHITECTURE.md puts the detail page behind ISR so a traffic spike
      // doesn't become a Postgres connection spike; direct hits to this route
      // need their own shared-cache boundary to get the same protection.
      headers: { "cache-control": "public, s-maxage=60, stale-while-revalidate=300" },
    },
  );
}
