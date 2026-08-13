import { put } from "@vercel/blob";

import type { SandboxResult, WriteBlobResult } from "@/lib/workflow/types";

export function attemptBlobKey(runId: string, attempt: number): string {
  return `runs/${runId}/attempt-${attempt}.json`;
}

/**
 * The one and only Blob write in this system, per docs/DATA_MODEL.md: exactly
 * one `put()` per finished attempt, at a deterministic key, never polled and
 * never rewritten. Nothing in this module may grow a loop or a timer.
 *
 * A failed write is returned, not thrown. Throwing would hand the step runner a
 * retry — and a retrying write against a store that is rejecting writes is
 * precisely the operation-quota burn docs/SECURITY.md describes. The attempt's
 * pass/fail verdict is already established by this point and stays authoritative;
 * the run just ends up with no artifact pointer.
 */
export async function writeAttemptBlob(
  runId: string,
  attempt: number,
  submittedCode: string,
  sandboxResult: SandboxResult,
): Promise<WriteBlobResult> {
  "use step";

  const key = attemptBlobKey(runId, attempt);
  const payload = {
    run_id: runId,
    attempt,
    submitted_code: submittedCode,
    execution_stdout: sandboxResult.stdout,
    execution_stderr: sandboxResult.stderr,
    test_results: sandboxResult.per_case_results,
    sandbox_duration_ms: sandboxResult.sandbox_duration_ms,
  };

  try {
    await put(key, JSON.stringify(payload), {
      access: "public",
      addRandomSuffix: false,
      contentType: "application/json",
    });
    return { ok: true, key };
  } catch (err) {
    const message = err instanceof Error ? `${err.name}: ${err.message}` : String(err);
    console.error(`blob write failed for ${key}: ${message}`);
    return { ok: false, error: message };
  }
}
