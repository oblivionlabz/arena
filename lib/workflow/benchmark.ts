import { getWorkflowMetadata } from "workflow";

import { MAX_FAILURE_CONTEXT_CHARS } from "@/lib/workflow/config";
import { writeAttemptBlob } from "@/lib/workflow/steps/blob";
import {
  completeChallenge,
  createRun,
  finalizeRun,
  loadActiveModels,
  loadChallenge,
} from "@/lib/workflow/steps/db";
import { callModel } from "@/lib/workflow/steps/model";
import { runInSandbox } from "@/lib/workflow/steps/sandbox";
import type {
  ChallengeSpec,
  ModelSpec,
  RunOutcome,
  SandboxResult,
} from "@/lib/workflow/types";

/** What the next attempt is told about the last one. Bounded — it goes into a prompt. */
function summarizeFailure(result: SandboxResult): string {
  if (result.error) return `Execution could not complete: ${result.error}`;

  const failed = result.per_case_results.filter((r) => !r.passed).map((r) => r.case);
  return [
    `Failed test case(s): ${failed.join(", ")} of ${result.per_case_results.length}.`,
    `stdout:\n${result.stdout}`,
    `stderr:\n${result.stderr}`,
  ]
    .join("\n")
    .slice(0, MAX_FAILURE_CONTEXT_CHARS);
}

/**
 * One model's branch of the race — docs/WORKFLOWS.md's `attemptModel` state
 * machine. Awaited directly by the parent so its steps run in the parent's
 * durable context, and `Promise.all` in the parent is what makes the branches
 * concurrent.
 */
export async function attemptModel(
  challenge: ChallengeSpec,
  model: ModelSpec,
  workflowRunId: string,
): Promise<RunOutcome> {
  "use workflow";

  const { runId, maxAttempts } = await createRun(challenge.id, model.id, workflowRunId);

  let attempt = 1;
  let priorFailureContext: string | null = null;
  let lastBlobKey: string | null = null;

  try {
    for (;;) {
      const generated = await callModel(
        model.gatewayModel,
        challenge.prompt,
        challenge.language,
        priorFailureContext,
      );

      if (!generated.ok) {
        // A provider error still consumes an attempt — there is just no code to
        // execute and therefore no attempt artifact to write.
        if (attempt >= maxAttempts) {
          await finalizeRun(runId, "error", attempt, lastBlobKey);
          return { runId, modelSlug: model.slug, status: "error", attemptsUsed: attempt, blobKey: lastBlobKey };
        }
        priorFailureContext = `The previous attempt never ran: ${generated.error}`;
        attempt += 1;
        continue;
      }

      const sandboxResult = await runInSandbox(
        challenge.language,
        generated.code,
        challenge.testCases,
      );

      const blob = await writeAttemptBlob(runId, attempt, generated.code, sandboxResult);
      if (blob.ok) lastBlobKey = blob.key;

      if (sandboxResult.passed) {
        await finalizeRun(runId, "passed", attempt, lastBlobKey);
        return { runId, modelSlug: model.slug, status: "passed", attemptsUsed: attempt, blobKey: lastBlobKey };
      }

      if (attempt >= maxAttempts) {
        const status = sandboxResult.error ? "error" : "failed";
        await finalizeRun(runId, status, attempt, lastBlobKey);
        return { runId, modelSlug: model.slug, status, attemptsUsed: attempt, blobKey: lastBlobKey };
      }

      priorFailureContext = summarizeFailure(sandboxResult);
      attempt += 1;
    }
  } catch (err) {
    // A branch that dies must not leave its row stuck at 'running' forever —
    // the leaderboard would count it as a race still in progress.
    console.error(`run ${runId} (${model.slug}) failed:`, err);
    await finalizeRun(runId, "error", attempt, lastBlobKey);
    return { runId, modelSlug: model.slug, status: "error", attemptsUsed: attempt, blobKey: lastBlobKey };
  }
}

/**
 * The benchmark cycle — docs/WORKFLOWS.md's `benchmarkChallenge`. Started with
 * `start(benchmarkChallenge, [challengeId])`; the Cron trigger that will call
 * it belongs to the `ops/` worktree (M3).
 */
export async function benchmarkChallenge(challengeId: string) {
  "use workflow";

  const { workflowRunId } = getWorkflowMetadata();

  const challenge = await loadChallenge(challengeId);
  const models = await loadActiveModels();

  // Fanned out, not awaited in sequence — the concurrency is the race. Each
  // branch is settled individually so that one collapsing outright can't
  // discard the results of the models that did finish.
  const settled = await Promise.all(
    models.map((model) =>
      attemptModel(challenge, model, workflowRunId).then(
        (outcome): { ok: true; outcome: RunOutcome } => ({ ok: true, outcome }),
        (error: unknown): { ok: false; model: string; error: string } => ({
          ok: false,
          model: model.slug,
          error: error instanceof Error ? error.message : String(error),
        }),
      ),
    ),
  );

  const outcomes = settled.filter((r) => r.ok).map((r) => r.outcome);

  await completeChallenge(challengeId);

  // M3 (`ops/` worktree) hangs the OG scorecard and the Connect-mediated
  // Discord digest off this point — docs/WORKFLOWS.md steps 5b and 5c.

  return {
    challengeId,
    challengeSlug: challenge.slug,
    workflowRunId,
    outcomes,
    failedBranches: settled.filter((r) => !r.ok),
  };
}
