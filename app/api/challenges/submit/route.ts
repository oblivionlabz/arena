// POST /api/challenges/submit — docs/API.md's only public write endpoint.
//
// Two invariants this file exists to hold, per docs/SECURITY.md:
//
//  1. The inserted row is always `status: "pending"`. It is written as a
//     literal below, never taken from the request body, so there is no input
//     that reaches `approved`/`active` — and therefore no path from this
//     endpoint to code execution. Rotation only ever selects `approved` rows,
//     which only the operator's moderation route can produce.
//  2. Every field is length-capped and sanitized *before* it is stored, not on
//     the way out — see ./validation.ts.
//
// Rate limiting for this route is a Vercel Firewall custom rule, not
// application code; it is documented in this PR and inspectable with
// `vercel firewall rules inspect "submit-challenge-rate-limit"`.
import { challenges } from "@/db/schema";
import { db } from "@/lib/db";

import { MAX_BODY_BYTES, slugFromTitle, validateSubmission } from "./validation";

export const dynamic = "force-dynamic";

const NO_STORE = { "cache-control": "no-store" };

/** Slug collisions are resolved by retrying the insert, not by pre-checking. */
const SLUG_ATTEMPTS = 5;

function fail(status: number, error: string, extra?: Record<string, unknown>) {
  return Response.json({ error, ...extra }, { status, headers: NO_STORE });
}

/**
 * Reads the body while counting bytes, and gives up the moment the cap is
 * passed. `request.text()` would decode the whole thing first and check after,
 * which on a public endpoint means an unbounded body still gets buffered before
 * anything rejects it — a `content-length` header is a claim, and a chunked
 * request doesn't have to make one at all.
 */
async function readBoundedBody(request: Request): Promise<string | null> {
  if (!request.body) return "";

  const reader = request.body.getReader();
  const chunks: Uint8Array[] = [];
  let total = 0;

  while (true) {
    const { done, value } = await reader.read();
    if (done) break;
    total += value.byteLength;
    if (total > MAX_BODY_BYTES) {
      await reader.cancel();
      return null;
    }
    chunks.push(value);
  }

  const merged = new Uint8Array(total);
  let offset = 0;
  for (const chunk of chunks) {
    merged.set(chunk, offset);
    offset += chunk.byteLength;
  }
  return new TextDecoder().decode(merged);
}

export async function POST(request: Request) {
  if (!request.headers.get("content-type")?.includes("application/json")) {
    return fail(415, "Content-Type must be application/json.");
  }

  // Cheap early reject when the client declares an oversized body; the read
  // below is what actually enforces the cap.
  const declaredLength = Number(request.headers.get("content-length"));
  if (Number.isFinite(declaredLength) && declaredLength > MAX_BODY_BYTES) {
    return fail(413, `Request body must be at most ${MAX_BODY_BYTES} bytes.`);
  }

  const body = await readBoundedBody(request);
  if (body === null) {
    return fail(413, `Request body must be at most ${MAX_BODY_BYTES} bytes.`);
  }

  let parsed: unknown;
  try {
    parsed = JSON.parse(body);
  } catch {
    return fail(400, "Request body must be valid JSON.");
  }

  const result = validateSubmission(parsed);
  if (!result.ok) {
    return fail(400, "Submission failed validation.", { fields: result.fieldErrors });
  }
  const submission = result.value;

  const base = slugFromTitle(submission.title);

  for (let attempt = 0; attempt < SLUG_ATTEMPTS; attempt++) {
    // A suffix is only added after the bare slug is known to be taken, so the
    // common case stays readable. Randomized rather than sequential: a counter
    // would need a read to know where to start, and that read races.
    const slug = attempt === 0 ? base : `${base}-${crypto.randomUUID().slice(0, 8)}`;

    // onConflictDoNothing + an empty `returning()` is the collision signal.
    // Postgres's unique index is what actually decides, so two simultaneous
    // submissions of the same title can't both win by checking first.
    const [row] = await db()
      .insert(challenges)
      .values({
        slug,
        title: submission.title,
        prompt: submission.prompt,
        language: submission.language,
        // docs/DATA_MODEL.md has test_cases NOT NULL, and writing the real ones
        // is the operator's job at moderation (docs/API.md's moderate route) —
        // a public submitter supplying the cases their own challenge is scored
        // against is not a thing this endpoint should accept. Empty array is
        // the "not yet authored" state; rotation only takes `approved` rows, so
        // an empty-cases row can never reach the Workflow.
        testCases: [],
        status: "pending",
        submittedBy: submission.submittedBy,
      })
      .onConflictDoNothing({ target: challenges.slug })
      .returning({ slug: challenges.slug });

    if (row) {
      return Response.json(
        { slug: row.slug, status: "pending" },
        { status: 201, headers: NO_STORE },
      );
    }
  }

  return fail(409, "Could not allocate a unique slug for that title. Try a different title.");
}
