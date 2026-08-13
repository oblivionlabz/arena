import { z } from "zod";

/** Shape of one entry in `challenges.test_cases` (jsonb) — see docs/DATA_MODEL.md. */
export const testCaseSchema = z.object({
  input: z.string(),
  expected_output: z.string(),
});

export const testCasesSchema = z.array(testCaseSchema).min(1);

export type TestCase = z.infer<typeof testCaseSchema>;

export type ChallengeSpec = {
  id: string;
  slug: string;
  prompt: string;
  language: string;
  testCases: TestCase[];
};

export type ModelSpec = {
  id: string;
  slug: string;
  gatewayModel: string;
  displayName: string;
};

export type TestCaseResult = { case: number; passed: boolean };

export type SandboxResult = {
  passed: boolean;
  per_case_results: TestCaseResult[];
  stdout: string;
  stderr: string;
  sandbox_duration_ms: number;
  /** Non-null means the sandbox itself failed, as opposed to the code failing tests. */
  error: string | null;
};

export type CallModelResult =
  | { ok: true; code: string }
  | { ok: false; error: string };

export type WriteBlobResult =
  | { ok: true; key: string }
  | { ok: false; error: string };

export type RunOutcome = {
  runId: string;
  modelSlug: string;
  status: "passed" | "failed" | "error";
  attemptsUsed: number;
  blobKey: string | null;
};
