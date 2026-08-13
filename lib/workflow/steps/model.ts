import { generateText } from "ai";

import { MODEL_TIMEOUT_MS } from "@/lib/workflow/config";
import type { CallModelResult } from "@/lib/workflow/types";

// The output contract lives in the system prompt, and the challenge text is
// passed as the user message — never concatenated into these instructions.
// Challenge prompts are moderator-approved but still author-supplied text
// (docs/SECURITY.md), so they get to describe the problem, not to redefine
// what the model is supposed to emit.
function systemPrompt(language: string): string {
  return [
    `You are competing in a coding benchmark. Solve the problem in ${language}.`,
    "Your program reads its input from stdin and writes its answer to stdout.",
    "Respond with the complete program and nothing else — no explanation, no",
    "commentary. A single fenced code block is acceptable.",
  ].join("\n");
}

function userPrompt(challengePrompt: string, priorFailureContext: string | null): string {
  if (!priorFailureContext) return challengePrompt;
  return [
    challengePrompt,
    "",
    "Your previous submission was executed and did not pass:",
    priorFailureContext,
    "",
    "Return a corrected, complete program.",
  ].join("\n");
}

/** Pulls the program out of a fenced block, if the model wrapped it in one. */
function extractCode(text: string): string {
  const fenced = text.match(/```(?:[a-zA-Z0-9_+-]*)\n([\s\S]*?)```/);
  return (fenced ? fenced[1] : text).trim();
}

function describeError(err: unknown): string {
  if (err instanceof Error) return `${err.name}: ${err.message}`;
  return String(err);
}

/**
 * One AI Gateway call. Returns a result rather than throwing on provider
 * failure: a throw here would be retried by the step runner behind the
 * workflow's back, and docs/WORKFLOWS.md wants provider errors surfaced to the
 * attempt loop so the attempt count stays honest.
 */
export async function callModel(
  gatewayModel: string,
  challengePrompt: string,
  language: string,
  priorFailureContext: string | null,
): Promise<CallModelResult> {
  "use step";

  try {
    const { text } = await generateText({
      model: gatewayModel,
      system: systemPrompt(language),
      prompt: userPrompt(challengePrompt, priorFailureContext),
      abortSignal: AbortSignal.timeout(MODEL_TIMEOUT_MS),
    });

    const code = extractCode(text);
    if (!code) return { ok: false, error: "model returned an empty response" };
    return { ok: true, code };
  } catch (err) {
    return { ok: false, error: describeError(err) };
  }
}
