// GET /api/internal/challenges/pending — not in docs/API.md's original
// route list, added alongside the moderate route it exists to support. The
// documented moderate route takes a challenge id, but nothing else in this
// app ever surfaces a pending challenge's id (docs/SECURITY.md: pending rows
// are invisible everywhere public, on purpose) — without this, an operator
// has no way to discover what's waiting short of a direct DB query. Same
// auth as the moderate route.
import { asc, eq } from "drizzle-orm";

import { challenges } from "@/db/schema";
import { db } from "@/lib/db";
import { isInternalRequestAuthorized } from "@/lib/internal/auth";

export const dynamic = "force-dynamic";

const NO_STORE = { "cache-control": "no-store" };

export async function GET(request: Request) {
  if (!isInternalRequestAuthorized(request)) {
    return Response.json({ error: "Unauthorized." }, { status: 401, headers: NO_STORE });
  }

  const rows = await db()
    .select({
      id: challenges.id,
      slug: challenges.slug,
      title: challenges.title,
      prompt: challenges.prompt,
      language: challenges.language,
      submittedBy: challenges.submittedBy,
      createdAt: challenges.createdAt,
    })
    .from(challenges)
    .where(eq(challenges.status, "pending"))
    .orderBy(asc(challenges.createdAt));

  return Response.json({ challenges: rows }, { headers: NO_STORE });
}
