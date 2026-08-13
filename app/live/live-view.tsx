"use client";

import Link from "next/link";
import { useCallback, useEffect, useState } from "react";

import { RunStatusChip } from "@/app/_components/status-chip";
import type { ActiveChallenge } from "@/app/_lib/api";
import { formatDuration, formatElapsed, formatUtc } from "@/app/_lib/format";
import { modelColor } from "@/app/_lib/model-color";

import styles from "./live.module.css";

// docs/API.md: GET /api/challenges/active is a short-poll target — "client
// polls this on a multi-second interval while a challenge is active, stops
// once it's completed". Five seconds is fast enough that a status flip is
// seen almost immediately, slow enough that it stays an Edge Config read plus
// one light status query rather than a load source.
const POLL_ACTIVE_MS = 5_000;
// Nothing is running: the next thing that can change is a daily rotation, so
// polling at the live interval would spend reads to watch paint dry.
const POLL_IDLE_MS = 30_000;

type PollState = "polling" | "stopped" | "failing";

export function LiveView({
  initial,
  fetchedAt,
}: {
  initial: ActiveChallenge;
  // The server's clock when `initial` was read. Seeding the elapsed-time
  // ticker from it rather than from Date.now() on the client is what keeps
  // the first client render identical to the server's — otherwise every
  // in-flight run hydrates with a different number of seconds on it.
  fetchedAt: number;
}) {
  const [data, setData] = useState(initial);
  const [failing, setFailing] = useState(false);
  const [fetching, setFetching] = useState(false);
  const [lastUpdated, setLastUpdated] = useState<number | null>(null);
  const [now, setNow] = useState(fetchedAt);

  const isCompleted = data.challenge?.status === "completed";
  const isRacing = data.active && !isCompleted;

  // The one place this page reaches outside its own DOM subtree: a data
  // attribute on <html>, read by globals.css to brighten the ambient
  // background bloom while a race is actually running. Reverts on
  // unmount/navigation and whenever isRacing flips, so leaving this page
  // (or the race ending) always settles it back — see globals.css for the
  // CSS side.
  useEffect(() => {
    document.documentElement.dataset.raceLive = isRacing ? "true" : "false";
    return () => {
      delete document.documentElement.dataset.raceLive;
    };
  }, [isRacing]);

  const load = useCallback(async () => {
    setFetching(true);
    try {
      const response = await fetch("/api/challenges/active", {
        cache: "no-store",
      });
      if (!response.ok) throw new Error(`HTTP ${response.status}`);
      setData((await response.json()) as ActiveChallenge);
      setFailing(false);
      setLastUpdated(Date.now());
    } catch {
      // A stale page that still looks live is the failure mode worth avoiding
      // here; the poll bar says so rather than silently freezing.
      setFailing(true);
    } finally {
      setFetching(false);
    }
  }, []);

  // The poll itself. A chained timeout rather than setInterval so a slow
  // response can't stack requests on top of each other.
  useEffect(() => {
    if (isCompleted) return; // Terminal state — stop, per docs/API.md.

    let timer: ReturnType<typeof setTimeout>;
    const tick = () => {
      const interval = isRacing ? POLL_ACTIVE_MS : POLL_IDLE_MS;
      timer = setTimeout(async () => {
        // Polling a tab nobody is looking at buys nothing; the visibility
        // listener below refreshes immediately on return.
        if (document.visibilityState === "visible") await load();
        tick();
      }, interval);
    };
    tick();

    const onVisible = () => {
      if (document.visibilityState === "visible") void load();
    };
    document.addEventListener("visibilitychange", onVisible);

    return () => {
      clearTimeout(timer);
      document.removeEventListener("visibilitychange", onVisible);
    };
  }, [isCompleted, isRacing, load]);

  // Local clock for in-flight elapsed times. Costs no requests.
  const hasRunning = data.runs.some((run) => run.status === "running");
  useEffect(() => {
    if (!hasRunning) return;
    const timer = setInterval(() => setNow(Date.now()), 1_000);
    return () => clearInterval(timer);
  }, [hasRunning]);

  const pollState: PollState = isCompleted
    ? "stopped"
    : failing
      ? "failing"
      : "polling";

  if (!data.active || !data.challenge) {
    return (
      <>
        <div className={styles.pageHead}>
          <h1 className="eyebrow">Live view</h1>
          <p className={styles.pageHeadNote}>
            Updates while a challenge is running · no refresh needed
          </p>
        </div>
        <PollBar
          state={pollState}
          lastUpdated={lastUpdated}
          fetching={fetching}
          onRecheck={load}
          label={failing ? "connection lost" : "standing by · 30s"}
        />
        <section className={styles.panel}>
          <p className="eyebrow">Nothing on the grid</p>
          <h2 className={styles.panelTitle}>No challenge is running.</h2>
          <p className={styles.panelBody}>
            A challenge rotates in daily at 00:00 UTC. When one does, every model
            in rotation gets the same prompt at the same moment and this page
            fills with their live status — running, passed, failed — as each
            sandbox finishes.
          </p>
          {data.rotationLocked && (
            <p className={styles.locked}>
              Rotation is currently locked by the operator, so the next
              changeover may not happen on schedule.
            </p>
          )}
          <div className={styles.panelActions}>
            <Link href="/" className={styles.detailLink}>
              See the standings →
            </Link>
          </div>
        </section>
      </>
    );
  }

  const { challenge, runs } = data;

  return (
    <>
      <header className={styles.head}>
        <div className={styles.headTop}>
          <p className="eyebrow">
            {isCompleted ? "Final result" : "Challenge in progress"}
          </p>
          <span className={styles.pageHeadNote}>
            {isCompleted
              ? "This race is over — standings updated"
              : "Updating live · no refresh needed"}
          </span>
        </div>
        <h1 className={styles.title}>{challenge.title}</h1>
        <div className={styles.headMeta}>
          <span>
            Language <strong>{challenge.language}</strong>
          </span>
          <span>
            Started{" "}
            <strong>{formatUtc(challenge.startedAt ?? challenge.activatedAt)}</strong>
          </span>
          <span>
            Models <strong>{runs.length}</strong>
          </span>
          <Link href={`/challenges/${challenge.slug}`} className={styles.detailLink}>
            Full challenge detail →
          </Link>
        </div>
      </header>

      <PollBar
        state={pollState}
        lastUpdated={lastUpdated}
        fetching={fetching}
        onRecheck={load}
        label={
          isCompleted
            ? "polling stopped · race complete"
            : failing
              ? "connection lost"
              : "live · 5s"
        }
      />

      {isCompleted && (
        <div className={styles.done}>
          <span className="eyebrow">Race complete</span>
          <Link
            href={`/challenges/${challenge.slug}`}
            className={styles.detailLink}
          >
            Read the full result →
          </Link>
        </div>
      )}

      {runs.length === 0 ? (
        <section className={styles.panel}>
          <p className="eyebrow">Grid forming</p>
          <h2 className={styles.panelTitle}>
            The challenge is live, but no model has been dispatched yet.
          </h2>
          <p className={styles.panelBody}>
            Runs appear here the moment the benchmark workflow queues them.
          </p>
        </section>
      ) : (
        <ul className={styles.lanes}>
          {runs.map((run, index) => (
            <li
              key={run.id}
              className={`${styles.lane} ${styles[run.status]} rise`}
              style={{ "--i": index } as React.CSSProperties}
            >
              <div className={styles.laneIdentity}>
                <span className={styles.laneName}>
                  <span
                    className="modelDot"
                    style={{ "--model-color": modelColor(run.model.slug) } as React.CSSProperties}
                  />
                  {run.model.displayName}
                </span>
                <span className={styles.laneSlug}>{run.model.slug}</span>
              </div>
              <div className={styles.laneReadout}>
                <div className={styles.attempts}>
                  <span className="eyebrow">
                    {run.attemptsUsed}/{run.maxAttempts}
                  </span>
                  <span className={styles.pips}>
                    {Array.from({ length: run.maxAttempts }, (_, i) => (
                      <span
                        key={i}
                        className={`${styles.pip} ${pipClass(run.status, i < run.attemptsUsed)}`}
                      />
                    ))}
                  </span>
                </div>
                <span
                  className={`${styles.timer} ${run.status === "running" ? styles.live : ""}`}
                >
                  {run.status === "running"
                    ? formatElapsed(run.startedAt, now)
                    : formatDuration(run.timeToSolveMs)}
                </span>
                {/* Keyed on status so a transition remounts and replays the
                    flash — the motion marks the change, not the element. */}
                <span key={run.status} className={styles.flash}>
                  <RunStatusChip status={run.status} />
                </span>
              </div>
            </li>
          ))}
        </ul>
      )}
    </>
  );
}

function pipClass(status: string, used: boolean): string {
  if (!used) return "";
  if (status === "passed") return styles.usedHot;
  if (status === "failed" || status === "error") return styles.usedFail;
  return styles.used;
}

function PollBar({
  state,
  label,
  lastUpdated,
  fetching,
  onRecheck,
}: {
  state: PollState;
  label: string;
  lastUpdated: number | null;
  fetching: boolean;
  onRecheck: () => void;
}) {
  return (
    <div className={styles.pollBar}>
      <span className={styles.pollState}>
        <span className={`${styles.pollDot} ${styles[state]}`} />
        {label}
      </span>
      <span className={styles.pollState}>
        {/* Only ever set by a client-side poll, so there is no server render
            of this to disagree with. */}
        {lastUpdated !== null && (
          <span>Updated {formatUtc(new Date(lastUpdated).toISOString())}</span>
        )}
        <button
          type="button"
          className={styles.recheck}
          onClick={onRecheck}
          disabled={fetching}
        >
          {fetching ? "checking…" : "check now"}
        </button>
      </span>
    </div>
  );
}
