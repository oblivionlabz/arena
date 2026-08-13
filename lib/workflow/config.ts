// Execution limits for one attempt. The ordering here is the point, per
// docs/SECURITY.md: the innermost limit must trip first, so a runaway
// submission is stopped by the test harness, not by the platform.
//
//   TEST_CASE_TIMEOUT_MS  <  SANDBOX_COMMAND_TIMEOUT_MS  <  SANDBOX_TIMEOUT_MS
//   (per test case)          (whole harness run)            (VM auto-terminate)

export const TEST_CASE_TIMEOUT_MS = 10_000;
export const SANDBOX_COMMAND_TIMEOUT_MS = 60_000;
export const SANDBOX_TIMEOUT_MS = 90_000;

/** 2048 MB of memory is allocated per vCPU. */
export const SANDBOX_VCPUS = 1;

/** callModel fails fast on this bound; waiting is the Workflow's job, not a Function's. */
export const MODEL_TIMEOUT_MS = 120_000;

/** Caps on captured output, so one noisy submission can't write an unbounded blob. */
export const MAX_CAPTURED_OUTPUT_CHARS = 20_000;
export const MAX_FAILURE_CONTEXT_CHARS = 2_000;

/** The only language docs/PRODUCT.md puts in v1 scope. */
export const SUPPORTED_LANGUAGE = "python";
export const SANDBOX_RUNTIME = "python3.13";
