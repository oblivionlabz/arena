// docs/WORKFLOWS.md step 5c, wired from benchmark.ts. Deliberately its own
// query rather than reusing loadChallenge()/attemptModel()'s data — this
// runs after every branch has already finalized its own `runs` row, so
// reading fresh off Postgres is simpler and more honest than threading
// display-only fields (title, model display names) through types the rest
// of the state machine doesn't otherwise need. See lib/ops/discord.ts for
// why this posts to a webhook instead of through Connect.
import { eq } from "drizzle-orm";

import { sendDigest } from "@/lib/ops/discord";
import { challenges, models, runs } from "@/db/schema";
import { getDb } from "@/lib/workflow/db";

function siteUrl(): string {
  const host = process.env.VERCEL_PROJECT_PRODUCTION_URL;
  return host ? `https://${host}` : "http://localhost:3000";
}

export async function postDigest(challengeId: string): Promise<void> {
  "use step";

  const db = getDb();
  const rows = await db
    .select({
      slug: challenges.slug,
      title: challenges.title,
      language: challenges.language,
      status: runs.status,
      attemptsUsed: runs.attemptsUsed,
      timeToSolveMs: runs.timeToSolveMs,
      modelDisplayName: models.displayName,
    })
    .from(challenges)
    .innerJoin(runs, eq(runs.challengeId, challenges.id))
    .innerJoin(models, eq(models.id, runs.modelId))
    .where(eq(challenges.id, challengeId));

  if (rows.length === 0) {
    // Every branch errored before creating a `runs` row (all providers down,
    // say) — there is genuinely nothing to report, not a bug in this step.
    console.error(`postDigest: no runs found for challenge ${challengeId}, skipping.`);
    return;
  }

  const [{ slug, title, language }] = rows;

  const result = await sendDigest({
    challengeSlug: slug,
    challengeTitle: title,
    language,
    siteUrl: siteUrl(),
    runs: rows
      .filter((r): r is typeof r & { status: "passed" | "failed" | "error" } =>
        r.status === "passed" || r.status === "failed" || r.status === "error",
      )
      .map((r) => ({
        modelDisplayName: r.modelDisplayName,
        status: r.status,
        attemptsUsed: r.attemptsUsed,
        timeToSolveMs: r.timeToSolveMs,
      })),
  });

  // A missed digest doesn't undo a real, already-scored race — it's the one
  // thing the Discord community would notice, and the leaderboard is still
  // correct without it. Log loudly, don't fail the Workflow over it.
  if (!result.ok) {
    console.error(`postDigest: ${result.reason}`);
  }
}
