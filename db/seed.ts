// Inserts one model and one approved challenge so a benchmark run has
// something real to execute against. Idempotent — re-running updates the
// existing rows by slug rather than creating duplicates.
//
// Run with: pnpm db:seed  (requires DATABASE_URL, e.g. via `vercel env pull`)
import { neon } from "@neondatabase/serverless";
import { drizzle } from "drizzle-orm/neon-http";

import { challenges, models } from "./schema";

const SEED_MODEL = {
  slug: "gpt-4o-mini",
  gatewayModel: "openai/gpt-4o-mini",
  displayName: "GPT-4o mini",
  active: true,
};

const SEED_CHALLENGE = {
  slug: "sum-two-integers",
  title: "Sum two integers",
  prompt:
    "Read two space-separated integers from a single line on stdin and print their sum to stdout.",
  testCases: [
    { input: "2 3\n", expected_output: "5" },
    { input: "-4 9\n", expected_output: "5" },
    { input: "0 0\n", expected_output: "0" },
  ],
  language: "python",
  status: "approved",
  submittedBy: "seed",
};

async function main() {
  const databaseUrl = process.env.DATABASE_URL;
  if (!databaseUrl) {
    throw new Error("DATABASE_URL is not set — pull it with `vercel env pull .env.local` first.");
  }
  const db = drizzle(neon(databaseUrl));

  const [model] = await db
    .insert(models)
    .values(SEED_MODEL)
    .onConflictDoUpdate({ target: models.slug, set: SEED_MODEL })
    .returning({ id: models.id, slug: models.slug });

  const [challenge] = await db
    .insert(challenges)
    .values(SEED_CHALLENGE)
    .onConflictDoUpdate({ target: challenges.slug, set: SEED_CHALLENGE })
    .returning({ id: challenges.id, slug: challenges.slug });

  console.log(`model:     ${model.slug} (${model.id})`);
  console.log(`challenge: ${challenge.slug} (${challenge.id})`);
}

main().catch((err) => {
  console.error(err);
  process.exit(1);
});
