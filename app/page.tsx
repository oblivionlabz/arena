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
          <Signalband />
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

const SIGNAL_BARS = 16;

/**
 * Purely decorative, purely CSS — animates whether or not anything is
 * actually racing. The gated, real-data-driven "live" cues (nav dot,
 * background boost, lane flashes) tell the truth about right now; this is
 * the one motion element allowed to lie a little, the same way a stereo's
 * level meter runs even on a quiet track. Renders identically on server
 * and client, so there's nothing here to hydrate-mismatch.
 */
function Signalband() {
  return (
    <div className={styles.signalband} aria-hidden="true">
      {Array.from({ length: SIGNAL_BARS }, (_, i) => (
        <span key={i} style={{ "--i": i } as React.CSSProperties} />
      ))}
    </div>
  );
}

function Standings({ models }: { models: LeaderboardModel[] }) {
  const [leader, ...rest] = models;

  return (
    <div className={styles.board}>
      {/* The leader is a distinct object, not the biggest row in a list: it
          floats above the ledger on real elevation, overlapping its top
          edge, so rank 1 reads as raised off the plane the rest of the
          field sits on rather than just bigger text in the same box. */}
      <div className={`${styles.leaderSlot} rise`}>
        <LeadRow model={leader} />
      </div>

      {rest.length > 0 && (
        <ol className={`${styles.ledgerWrap} ledger raised`}>
          <li className={styles.columns} aria-hidden="true">
            <span />
            <span />
            <span className={styles.statLabel}>Win rate</span>
            <span className={styles.statLabel}>Avg solve</span>
            <span className={styles.statLabel}>Streak</span>
          </li>
          {rest.map((model, index) => (
            <li
              key={model.slug}
              className={`${styles.ledgerLine} ledgerRow rise`}
              style={{ "--i": index + 1 } as React.CSSProperties}
            >
              <ChaseRow
                model={model}
                rank={index + 2}
                tier={index < 2 ? "chase" : "pack"}
              />
            </li>
          ))}
        </ol>
      )}
    </div>
  );
}

function LeadRow({ model }: { model: LeaderboardModel }) {
  return (
    <article className={`${styles.leadCard} floating`}>
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
    <div className={styles[tier]}>
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
    </div>
  );
}

function StartingGrid({ models }: { models: LeaderboardModel[] }) {
  return (
    <div className={styles.startingBoard}>
      <div className={`${styles.empty} floating rise`}>
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
        <ol className={`${styles.rosterWrap} ledger raised`}>
          {models.map((model, index) => (
            <li
              key={model.slug}
              className={`${styles.rosterLine} ledgerRow rise`}
              style={{ "--i": index + 1 } as React.CSSProperties}
            >
              <h3 className={styles.gridName}>
                <span
                  className="modelDot"
                  style={{ "--model-color": modelColor(model.slug) } as React.CSSProperties}
                />
                {model.displayName}
              </h3>
              <p className={styles.gridSlug}>{model.slug}</p>
              <span className={styles.idleTag}>
                {model.active ? "in rotation" : "out of rotation"}
              </span>
            </li>
          ))}
        </ol>
      )}
    </div>
  );
}
