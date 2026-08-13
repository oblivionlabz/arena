import type { Metadata } from "next";
import Link from "next/link";
import { notFound } from "next/navigation";

import { ChallengeStatusChip, RunStatusChip } from "@/app/_components/status-chip";
import { fetchChallenge, type ChallengeDetail } from "@/app/_lib/api";
import { formatDuration, formatUtc } from "@/app/_lib/format";

import styles from "./challenge.module.css";

// ISR, same 60s window as the leaderboard and the route's own cache header.
// A challenge's prompt never changes; its run summaries settle within one
// benchmark cycle. The live view is where sub-minute freshness lives.
export const revalidate = 60;

export async function generateMetadata({
  params,
}: {
  params: Promise<{ slug: string }>;
}): Promise<Metadata> {
  const { slug } = await params;
  const detail = await fetchChallenge(slug);
  if (!detail) return { title: "Challenge not found" };
  return { title: detail.challenge.title };
}

export default async function ChallengePage({
  params,
}: {
  params: Promise<{ slug: string }>;
}) {
  const { slug } = await params;
  const detail = await fetchChallenge(slug);
  if (!detail) notFound();

  const { challenge, runs } = detail;
  const solved = runs.filter((run) => run.status === "passed").length;

  return (
    <main className={`shell ${styles.page}`}>
      <Link href="/" className={styles.back}>
        ← Standings
      </Link>

      <header className={styles.head}>
        <div className={styles.headRow}>
          <p className="eyebrow">Challenge</p>
          <ChallengeStatusChip status={challenge.status} />
        </div>
        <h1 className={styles.title}>{challenge.title}</h1>
        <div className={styles.facts}>
          <div className={styles.fact}>
            <span className={styles.factLabel}>Language</span>
            <span className={styles.factValue}>{challenge.language}</span>
          </div>
          <div className={styles.fact}>
            <span className={styles.factLabel}>Test cases</span>
            <span className={styles.factValue}>{challenge.testCaseCount}</span>
          </div>
          <div className={styles.fact}>
            <span className={styles.factLabel}>Submitted by</span>
            <span className={styles.factValue}>
              {challenge.submittedBy ?? "anonymous"}
            </span>
          </div>
          <div className={styles.fact}>
            {/* Falls back through the challenge's own lifecycle rather than
                printing an em dash for a date that hasn't happened yet. */}
            <span className={styles.factLabel}>
              {challenge.completedAt
                ? "Completed"
                : challenge.activatedAt
                  ? "Activated"
                  : "Submitted"}
            </span>
            <span className={styles.factValue}>
              {formatUtc(
                challenge.completedAt ??
                  challenge.activatedAt ??
                  challenge.createdAt,
              )}
            </span>
          </div>
        </div>
      </header>

      <div className={styles.body}>
        <div>
          <section>
            <div className={styles.sectionHead}>
              <h2 className="eyebrow">The prompt</h2>
              <span className={styles.factLabel}>
                Sent verbatim to every model
              </span>
            </div>
            <p className={styles.prompt}>{challenge.prompt}</p>
          </section>

          <section style={{ marginTop: "var(--s-16)" }}>
            <div className={styles.sectionHead}>
              <h2 className="eyebrow">Runs</h2>
              <span className={styles.factLabel}>
                {solved}/{runs.length} solved
              </span>
            </div>
            {runs.length === 0 ? (
              <div className={styles.empty}>
                <p className={styles.emptyTitle}>No model has attempted this yet.</p>
                <p>
                  This challenge is approved and waiting its turn in the daily
                  rotation. Runs appear here once it goes live.
                </p>
              </div>
            ) : (
              <ul className={styles.runs}>
                {runs.map((run, index) => (
                  <RunRow key={run.id} run={run} index={index} />
                ))}
              </ul>
            )}
          </section>
        </div>

        <aside className={styles.aside}>
          <div className={styles.card}>
            <p className="eyebrow">Test cases</p>
            <p className={styles.cardValue}>{challenge.testCaseCount}</p>
            {challenge.testCases ? (
              <>
                <p className={styles.cardNote}>
                  Published now that the challenge is complete.
                </p>
                <ul className={styles.cases}>
                  {challenge.testCases.map((testCase, index) => (
                    <li key={index} className={styles.case}>
                      <span className={styles.factLabel}>Case {index + 1}</span>
                      <span className={styles.caseIo}>
                        in: {testCase.input ?? "—"}
                      </span>
                      <span className={styles.caseIo}>
                        out: {testCase.expected_output ?? "—"}
                      </span>
                    </li>
                  ))}
                </ul>
              </>
            ) : (
              // The API withholds the content itself (docs/SECURITY.md); the
              // page doesn't try to imply more than the count it was given.
              <p className={styles.withheld}>
                Contents are withheld while the challenge can still be run. They
                get published in full once it completes — a model that could read
                the cases mid-race wouldn&apos;t be solving the same problem as
                the one that ran first.
              </p>
            )}
          </div>

          <div className={styles.note}>
            <p className="eyebrow">How this is scored</p>
            <p className={styles.cardNote}>
              Each model gets the prompt above and up to three attempts. Every
              attempt executes in its own isolated sandbox against the test
              cases — pass or fail is the sandbox&apos;s verdict, not a
              judgement about the code.
            </p>
          </div>
        </aside>
      </div>
    </main>
  );
}

function RunRow({
  run,
  index,
}: {
  run: ChallengeDetail["runs"][number];
  index: number;
}) {
  return (
    <li
      className={`${styles.run} ${styles[run.status]} rise`}
      style={{ "--i": index } as React.CSSProperties}
    >
      <div>
        <p className={styles.runName}>{run.model.displayName}</p>
        <p className={styles.runSlug}>{run.model.slug}</p>
      </div>
      <div className={styles.runReadout}>
        <div className={styles.runStat}>
          <span className={styles.runStatLabel}>Attempts</span>
          <span className={styles.runStatValue}>
            {run.attemptsUsed}/{run.maxAttempts}
          </span>
        </div>
        <div className={styles.runStat}>
          <span className={styles.runStatLabel}>Time to solve</span>
          <span
            className={`${styles.runStatValue} ${run.status === "passed" ? styles.hot : ""}`}
          >
            {formatDuration(run.timeToSolveMs)}
          </span>
        </div>
        <RunStatusChip status={run.status} />
      </div>
    </li>
  );
}
