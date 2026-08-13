// POST /api/internal/challenges/[id]/moderate — docs/API.md's internal
// operator route: approves or rejects a `pending` challenge. Auth is
// lib/internal/auth.ts, shared across every route/page in app/*/internal/.
import { and, eq } from "drizzle-orm";
import { z } from "zod";

import { challenges } from "@/db/schema";
import { db } from "@/lib/db";
import { isInternalRequestAuthorized } from "@/lib/internal/auth";
import { testCasesSchema } from "@/lib/workflow/types";

export const dynamic = "force-dynamic";

const NO_STORE = { "cache-control": "no-store" };

function fail(status: number, error: string, extra?: Record<string, unknown>) {
  return Response.json({ error, ...extra }, { status, headers: NO_STORE });
}

const bodySchema = z.discriminatedUnion("action", [
  z.object({
    action: z.literal("approve"),
    // The submit endpoint (docs/SECURITY.md) deliberately writes
    // `test_cases: []` — a public submitter doesn't get to author the cases
    // their own challenge is scored against. Approving is the operator
    // supplying the real ones; this is the same schema
    // lib/workflow/steps/db.ts's loadChallenge() validates against, so an
    // approval that would crash the Workflow later gets rejected here
    // instead, at the one point a human is actually looking at it.
    testCases: testCasesSchema,
  }),
  z.object({ action: z.literal("reject") }),
]);

export async function POST(
  request: Request,
  { params }: { params: Promise<{ id: string }> },
) {
  if (!isInternalRequestAuthorized(request)) {
    return fail(401, "Unauthorized.");
  }

  const { id } = await params;

  let raw: unknown;
  try {
    raw = await request.json();
  } catch {
    return fail(400, "Request body must be valid JSON.");
  }

  const parsed = bodySchema.safeParse(raw);
  if (!parsed.success) {
    return fail(400, "Invalid request body.", { issues: parsed.error.flatten() });
  }

  const database = db();
  const [existing] = await database
    .select({ status: challenges.status, slug: challenges.slug })
    .from(challenges)
    .where(eq(challenges.id, id))
    .limit(1);

  if (!existing) {
    return fail(404, `No challenge with id '${id}'.`);
  }
  if (existing.status !== "pending") {
    return fail(
      409,
      `Challenge '${existing.slug}' is '${existing.status}', not 'pending' — only a pending challenge can be moderated.`,
    );
  }

  if (parsed.data.action === "approve") {
    await database
      .update(challenges)
      .set({ status: "approved", testCases: parsed.data.testCases })
      .where(and(eq(challenges.id, id), eq(challenges.status, "pending")));
    return Response.json(
      { id, slug: existing.slug, status: "approved" },
      { headers: NO_STORE },
    );
  }

  await database
    .update(challenges)
    .set({ status: "rejected" })
    .where(and(eq(challenges.id, id), eq(challenges.status, "pending")));
  return Response.json(
    { id, slug: existing.slug, status: "rejected" },
    { headers: NO_STORE },
  );
}
