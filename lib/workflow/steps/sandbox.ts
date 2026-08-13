import { Sandbox } from "@vercel/sandbox";

import {
  MAX_CAPTURED_OUTPUT_CHARS,
  SANDBOX_COMMAND_TIMEOUT_MS,
  SANDBOX_RUNTIME,
  SANDBOX_TIMEOUT_MS,
  SANDBOX_VCPUS,
  SUPPORTED_LANGUAGE,
  TEST_CASE_TIMEOUT_MS,
} from "@/lib/workflow/config";
import type { SandboxResult, TestCase } from "@/lib/workflow/types";

/**
 * Runs inside the sandbox and is the only trusted code in there. The
 * submission is never imported — it's spawned as a child process with its own
 * wall-clock timeout and a minimal environment, so a submission that hangs is
 * killed by this harness rather than by the platform.
 */
function harnessSource(): string {
  return `import json, pathlib, subprocess, sys

PER_CASE_TIMEOUT_S = ${TEST_CASE_TIMEOUT_MS / 1000}
MAX_CAPTURE = ${MAX_CAPTURED_OUTPUT_CHARS}
CHILD_ENV = {"PATH": "/usr/bin:/bin", "HOME": "/tmp"}

cases = json.loads(pathlib.Path("testcases.json").read_text())
results, outs, errs = [], [], []

for i, case in enumerate(cases):
    try:
        proc = subprocess.run(
            [sys.executable, "solution.py"],
            input=case["input"],
            capture_output=True,
            text=True,
            timeout=PER_CASE_TIMEOUT_S,
            env=CHILD_ENV,
        )
        stdout, stderr, code = proc.stdout, proc.stderr, proc.returncode
    except subprocess.TimeoutExpired:
        stdout, stderr, code = "", "timed out after %ss" % PER_CASE_TIMEOUT_S, -1
    except Exception as exc:
        stdout, stderr, code = "", "%s: %s" % (type(exc).__name__, exc), -1

    passed = code == 0 and stdout.strip() == case["expected_output"].strip()
    results.append({"case": i, "passed": passed})
    outs.append("--- case %d ---\\n%s" % (i, stdout))
    errs.append("--- case %d ---\\n%s" % (i, stderr))

pathlib.Path("results.json").write_text(json.dumps({
    "passed": all(r["passed"] for r in results),
    "per_case_results": results,
    "stdout": "\\n".join(outs)[:MAX_CAPTURE],
    "stderr": "\\n".join(errs)[:MAX_CAPTURE],
}))
`;
}

function failure(error: string, startedAt: number): SandboxResult {
  return {
    passed: false,
    per_case_results: [],
    stdout: "",
    stderr: "",
    sandbox_duration_ms: Date.now() - startedAt,
    error,
  };
}

/**
 * Executes one attempt's code against every test case in a fresh Sandbox.
 *
 * docs/SECURITY.md's isolation rules, and the lines that enforce them:
 *  - one Sandbox per attempt, torn down after — `Sandbox.create` per call plus
 *    the `finally` that always calls `stop()`; nothing is pooled or reused.
 *  - no secrets in the environment — `Sandbox.create` is called with no `env`,
 *    and the harness command with `env: {}`, so the submission sees neither
 *    DATABASE_URL, the Gateway key, nor the Blob token.
 *  - no outbound network — `networkPolicy: "deny-all"`, default-closed.
 *  - bounded resources — explicit vCPU cap plus the three nested timeouts in
 *    lib/workflow/config.ts.
 */
export async function runInSandbox(
  language: string,
  code: string,
  testCases: TestCase[],
): Promise<SandboxResult> {
  "use step";

  const startedAt = Date.now();

  if (language !== SUPPORTED_LANGUAGE) {
    return failure(`unsupported challenge language: ${language}`, startedAt);
  }

  let sandbox: Awaited<ReturnType<typeof Sandbox.create>> | undefined;
  try {
    sandbox = await Sandbox.create({
      runtime: SANDBOX_RUNTIME,
      timeout: SANDBOX_TIMEOUT_MS,
      resources: { vcpus: SANDBOX_VCPUS },
      networkPolicy: "deny-all",
    });

    await sandbox.writeFiles([
      { path: "solution.py", content: Buffer.from(code, "utf8") },
      { path: "harness.py", content: Buffer.from(harnessSource(), "utf8") },
      {
        path: "testcases.json",
        content: Buffer.from(JSON.stringify(testCases), "utf8"),
      },
    ]);

    const command = await sandbox.runCommand({
      cmd: "python3",
      args: ["harness.py"],
      env: {},
      signal: AbortSignal.timeout(SANDBOX_COMMAND_TIMEOUT_MS),
    });

    if (command.exitCode !== 0) {
      const stderr = await command.stderr();
      return failure(
        `test harness exited ${command.exitCode}: ${stderr.slice(0, 500)}`,
        startedAt,
      );
    }

    // Read the verdict from a file rather than the harness's stdout, so that
    // anything the submission writes to an inherited descriptor can't be
    // mistaken for a result.
    const raw = await sandbox.readFileToBuffer({ path: "results.json" });
    if (!raw) return failure("test harness produced no results", startedAt);

    const parsed = JSON.parse(raw.toString("utf8")) as Omit<
      SandboxResult,
      "sandbox_duration_ms" | "error"
    >;

    return {
      ...parsed,
      sandbox_duration_ms: Date.now() - startedAt,
      error: null,
    };
  } catch (err) {
    const message = err instanceof Error ? `${err.name}: ${err.message}` : String(err);
    return failure(message, startedAt);
  } finally {
    // One sandbox per attempt means this teardown is not optional. A failure to
    // stop must not mask the attempt's actual result — the VM's own `timeout`
    // is the backstop.
    await sandbox?.stop().catch(() => {});
  }
}
