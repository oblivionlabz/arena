import type { ChallengeStatus, RunStatus } from "@/app/_lib/api";

import styles from "./status.module.css";

const RUN_LABEL: Record<RunStatus, string> = {
  queued: "queued",
  running: "running",
  passed: "passed",
  failed: "failed",
  error: "error",
};

const CHALLENGE_LABEL: Record<ChallengeStatus, string> = {
  pending: "pending",
  approved: "queued for rotation",
  rejected: "rejected",
  active: "live",
  completed: "completed",
};

export function RunStatusChip({ status }: { status: RunStatus }) {
  return (
    <span className={`${styles.chip} ${styles[status]}`}>
      <span className={styles.dot} />
      {RUN_LABEL[status]}
    </span>
  );
}

export function ChallengeStatusChip({ status }: { status: ChallengeStatus }) {
  return (
    <span className={`${styles.chip} ${styles[status] ?? ""}`}>
      <span className={styles.dot} />
      {CHALLENGE_LABEL[status]}
    </span>
  );
}
