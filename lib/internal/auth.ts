// Shared by every route under app/api/internal/ — docs/API.md's decision,
// made here: a shared-secret header, constant-time compared, not Vercel
// deployment protection (see the moderate route for why). "Internal only"
// means "requires the secret," not "the secret matters less" —
// docs/SECURITY.md's constant-time-comparison note applies the same as it
// does to the public submission endpoint's future siblings.
import { createHash, timingSafeEqual } from "node:crypto";

/**
 * `timingSafeEqual` throws on a length mismatch, and a naive length check
 * before calling it just moves the timing leak from "does the content
 * match" to "does the length match" — hashing both sides to a fixed-length
 * digest first removes both problems at once, not just the crash.
 */
function safeEqual(a: string, b: string): boolean {
  const digestA = createHash("sha256").update(a).digest();
  const digestB = createHash("sha256").update(b).digest();
  return timingSafeEqual(digestA, digestB);
}

export function isInternalRequestAuthorized(request: Request): boolean {
  const internalToken = process.env.INTERNAL_TOKEN;
  if (!internalToken) return false;

  const authHeader = request.headers.get("authorization");
  if (!authHeader?.startsWith("Bearer ")) return false;

  return safeEqual(authHeader.slice("Bearer ".length), internalToken);
}
