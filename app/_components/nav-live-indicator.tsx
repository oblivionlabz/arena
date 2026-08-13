"use client";

import { useEffect, useState } from "react";

import type { ActiveChallenge } from "@/app/_lib/api";

// Chrome-level, not the /live page's own detail poll — this only ever
// answers "is a race happening right now," so it can afford to be much
// lighter than that page's 5s cadence. 30s keeps the nav honest without
// adding a meaningful request rate on every route in the site.
const POLL_MS = 30_000;

/**
 * Renders the same on the server and on first client paint (dim, no count)
 * so there's nothing to hydrate-mismatch on — the real state only exists
 * client-side, and arrives after the first poll resolves. The layout stays
 * a Server Component; this is the one piece of it that has to be client.
 */
export function NavLiveIndicator() {
  const [state, setState] = useState<{ racing: boolean; runningCount: number } | null>(null);

  useEffect(() => {
    let cancelled = false;
    let timer: ReturnType<typeof setTimeout>;

    async function poll() {
      try {
        const response = await fetch("/api/challenges/active", { cache: "no-store" });
        if (response.ok) {
          const data = (await response.json()) as ActiveChallenge;
          if (!cancelled) {
            setState({
              racing: data.active && data.challenge?.status !== "completed",
              runningCount: data.runs.filter((run) => run.status === "running").length,
            });
          }
        }
      } catch {
        // Ambient nav chrome, not a status page — a failed poll just leaves
        // the last-known state on screen. The /live page's own poll bar is
        // the honest, dedicated readout for connection health.
      }
      if (!cancelled) timer = setTimeout(() => void poll(), POLL_MS);
    }

    void poll();
    return () => {
      cancelled = true;
      clearTimeout(timer);
    };
  }, []);

  const racing = state?.racing ?? false;

  return (
    <>
      <span
        className={`pulseDot${racing ? " pulseDotLive" : ""}`}
        aria-hidden="true"
      />
      Live
      {racing && Boolean(state?.runningCount) && (
        <span className="liveCount">{state?.runningCount}</span>
      )}
    </>
  );
}
