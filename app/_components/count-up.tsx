"use client";

import { useEffect, useRef, useState } from "react";

import { formatDuration, formatPercent } from "@/app/_lib/format";

/**
 * A format *name*, not a formatter function — this component is used from
 * async Server Components (the leaderboard), and a function prop can't
 * cross that boundary (React Server Components only serialize plain data
 * across it; caught live: "Functions cannot be passed directly to Client
 * Components" — a 500 on every page render once a challenge had settled
 * runs, since that's the only state that reaches the percent/duration/streak
 * call sites). The actual formatting functions are imported and called
 * inside this client component instead, where they're just local code.
 */
type CountUpFormat = "integer" | "percent" | "duration" | "streak";

interface CountUpProps {
  value: number;
  format?: CountUpFormat;
  durationMs?: number;
}

function render(format: CountUpFormat, n: number): string {
  switch (format) {
    case "percent":
      return formatPercent(n);
    case "duration":
      return formatDuration(n);
    case "streak":
      return `${Math.round(n)}W`;
    case "integer":
      return `${Math.round(n)}`;
  }
}

/**
 * Renders `value` directly on first paint (so SSR/no-JS/reduced-motion all
 * show the correct number immediately, and hydration never mismatches),
 * then — client-side only, post-mount — resets to 0 and eases up to it.
 * The leaderboard is ISR: a new value only ever arrives via a fresh page
 * load, i.e. a fresh mount, never a live prop change mid-session, so this
 * only ever needs to animate once per instance, not react to updates.
 */
export function CountUp({ value, format = "integer", durationMs = 900 }: CountUpProps) {
  const [display, setDisplay] = useState(value);
  const rafRef = useRef<number | undefined>(undefined);

  useEffect(() => {
    // Already initialized to `value` — nothing to synchronize here, so
    // there's genuinely no setState on this path, not just a deferred one.
    if (window.matchMedia("(prefers-reduced-motion: reduce)").matches) {
      return;
    }

    // No separate "reset to 0" call: the first rAF tick computes t≈0 on its
    // own (now ≈ start), so the eased value already starts at ≈0 — one less
    // synchronous setState in the effect body, not just moved elsewhere.
    const start = performance.now();

    function tick(now: number) {
      const t = Math.min(1, (now - start) / durationMs);
      const eased = 1 - Math.pow(1 - t, 3);
      setDisplay(value * eased);
      if (t < 1) rafRef.current = requestAnimationFrame(tick);
    }

    rafRef.current = requestAnimationFrame(tick);
    return () => {
      if (rafRef.current !== undefined) cancelAnimationFrame(rafRef.current);
    };
    // eslint-disable-next-line react-hooks/exhaustive-deps -- runs once per mount, see comment above
  }, []);

  return <>{render(format, display)}</>;
}
