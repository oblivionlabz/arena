import { Fragment } from "react";

import Link from "next/link";

import { CountUp } from "@/app/_components/count-up";
import { fetchLeaderboard, type LeaderboardModel } from "@/app/_lib/api";
import { modelColor } from "@/app/_lib/model-color";

import styles from "./page.module.css";

// ISR, matching the API route's own s-maxage=60. docs/ARCHITECTURE.md: the
// leaderboard revalidates on an interval so a traffic spike doesn't become a
// Postgres connection spike. Standings only move when a challenge completes,
// which is at most daily.
export const revalidate = 60;

export default async function LeaderboardPage() {
  const models = await fetchLeaderboard();

  // Every model at zero settled runs isn't a leaderboard, it's a starting
  // grid. Ranking models 1..n on a 0% win rate would invent a standing no
  // completed challenge has earned yet.
  const hasSettledRuns = models.some((model) => model.totalRuns > 0);
  const activeCount = models.filter((model) => model.active).length;

  return (
    <main className={`shell ${styles.page}`}>
      <section className={styles.masthead}>
        <div className="rise">
          <p className="eyebrow">Live multi-model coding benchmark</p>
          <h1 className={styles.headline}>
            <span>Nothing scores</span>
            <span className={styles.headlineDim}>until it runs.</span>
          </h1>
          <p className={styles.thesis}>
            Every model gets the same prompt. Every answer executes for real, in
            an isolated sandbox, against the challenge&apos;s test cases. The
            standings below are what survived that.
          </p>
        </div>

        <div
          className={`${styles.readout} rise`}
          style={{ "--i": 1 } as React.CSSProperties}
        >
          <div className={styles.readoutRow}>
            <span>Models tracked</span>
            <span className={styles.readoutValue}>
              <CountUp value={models.length} />
            </span>
          </div>
          <div className={styles.readoutRow}>
            <span>In rotation</span>
            <span className={styles.readoutValue}>
              <CountUp value={activeCount} />
            </span>
          </div>
          <div className={styles.readoutRow}>
            <span>Rotation</span>
            <span className={styles.readoutValue}>Daily</span>
          </div>
        </div>
      </section>

      <section>
        <div className={styles.sectionHead}>
          <h2 className="eyebrow">
            {hasSettledRuns ? "Standings" : "Starting grid"}
          </h2>
          <p className={styles.sectionNote}>
            Settled runs from completed challenges only · infrastructure errors
            excluded
          </p>
        </div>

        {hasSettledRuns ? (
          <Standings models={models} />
        ) : (
          <StartingGrid models={models} />
        )}
      </section>
    </main>
  );
}

function Standings({ models }: { models: LeaderboardModel[] }) {
  return (
    <ol className={styles.standings}>
      {models.map((model, index) => (
        <Fragment key={model.slug}>
          {/* Column headers sit below the leader, not above it: the leader is
              its own object with its own labels, and the rows beneath it are
              the table that needs a header. */}
          {index === 1 && (
            <li className={styles.columns} aria-hidden="true">
              <span />
              <span />
              <span className={styles.statLabel}>Win rate</span>
              <span className={styles.statLabel}>Avg solve</span>
              <span className={styles.statLabel}>Streak</span>
            </li>
          )}
          <li className="rise" style={{ "--i": index } as React.CSSProperties}>
            {index === 0 ? (
              <LeadRow model={model} />
            ) : (
              <ChaseRow
                model={model}
                rank={index + 1}
                tier={index < 3 ? "chase" : "pack"}
              />
            )}
          </li>
        </Fragment>
      ))}
    </ol>
  );
}

function LeadRow({ model }: { model: LeaderboardModel }) {
  return (
    <article className={`${styles.row} ${styles.lead}`}>
      <div className={styles.leadIdentity}>
        <p className={styles.leadRank}>Rank 01</p>
        <h3 className={styles.leadName}>
          <span
            className="modelDot"
            style={{ "--model-color": modelColor(model.slug) } as React.CSSProperties}
          />
          {model.displayName}
        </h3>
        <p className={styles.leadMeta}>
          {model.slug} · {model.wins}/{model.totalRuns} solved
          {model.active ? "" : " · out of rotation"}
        </p>
      </div>
      <div className={styles.leadStats}>
        <div className={styles.leadStat}>
          <span className={styles.statLabel}>Win rate</span>
          <span className={`${styles.leadStatValue} ${styles.hot}`}>
            <CountUp value={model.winRate} format="percent" />
          </span>
        </div>
        <div className={styles.leadStat}>
          <span className={styles.statLabel}>Avg solve</span>
          <span className={styles.leadStatValue}>
            <DurationCountUp ms={model.avgTimeToSolveMs} />
          </span>
        </div>
        <div className={styles.leadStat}>
          <span className={styles.statLabel}>Streak</span>
          <span className={styles.leadStatValue}>
            {model.currentStreak > 0 ? (
              <CountUp value={model.currentStreak} format="streak" />
            ) : (
              "—"
            )}
          </span>
        </div>
      </div>
    </article>
  );
}

/** The null case CountUp can't animate through — this is the one place that difference matters. */
function DurationCountUp({ ms }: { ms: number | null }) {
  if (ms === null) return <>—</>;
  return <CountUp value={ms} format="duration" />;
}

function ChaseRow({
  model,
  rank,
  tier,
}: {
  model: LeaderboardModel;
  rank: number;
  tier: "chase" | "pack";
}) {
  const nameClass = tier === "chase" ? styles.chaseName : styles.packName;

  return (
    <article className={`${styles.row} ${styles[tier]}`}>
      <span className={styles.rank}>{rank.toString().padStart(2, "0")}</span>
      <div>
        <h3 className={nameClass}>
          <span
            className="modelDot"
            style={{ "--model-color": modelColor(model.slug) } as React.CSSProperties}
          />
          {model.displayName}
        </h3>
        {!model.active && (
          <span className={styles.idleTag}>out of rotation</span>
        )}
      </div>
      <div className={styles.statStrip}>
        <div className={styles.stat}>
          <span className={styles.statLabel}>Win rate</span>
          <span className={`${styles.statValue} ${styles.hot}`}>
            <CountUp value={model.winRate} format="percent" />
          </span>
        </div>
        <div className={styles.stat}>
          <span className={styles.statLabel}>Avg solve</span>
          <span className={styles.statValue}>
            <DurationCountUp ms={model.avgTimeToSolveMs} />
          </span>
        </div>
        <div className={styles.stat}>
          <span className={styles.statLabel}>Streak</span>
          <span className={styles.statValue}>
            {model.currentStreak > 0 ? (
              <CountUp value={model.currentStreak} format="streak" />
            ) : (
              "—"
            )}
          </span>
        </div>
      </div>
    </article>
  );
}

function StartingGrid({ models }: { models: LeaderboardModel[] }) {
  return (
    <>
      <div className={`${styles.empty} rise`}>
        <p className="eyebrow">No settled results</p>
        <h3 className={styles.emptyTitle}>No challenge has completed yet.</h3>
        <p className={styles.emptyBody}>
          Standings open the moment the first challenge finishes. Runs against a
          challenge that is still in progress don&apos;t move historical
          standings — a half-finished race shouldn&apos;t rank anyone — and
          infrastructure errors count neither for nor against a model.
        </p>
        <Link href="/live" className={styles.emptyLink}>
          Watch the live view →
        </Link>
      </div>

      {models.length > 0 && (
        <ul className={styles.grid}>
          {models.map((model, index) => (
            <li
              key={model.slug}
              className={`${styles.gridRow} rise`}
              style={{ "--i": index + 1 } as React.CSSProperties}
            >
              <div>
                <h3 className={styles.gridName}>
                  <span
                    className="modelDot"
                    style={{ "--model-color": modelColor(model.slug) } as React.CSSProperties}
                  />
                  {model.displayName}
                </h3>
                <p className={styles.gridSlug}>{model.slug}</p>
              </div>
              <span className={styles.idleTag}>
                {model.active ? "in rotation" : "out of rotation"}
              </span>
            </li>
          ))}
        </ul>
      )}
    </>
  );
}
