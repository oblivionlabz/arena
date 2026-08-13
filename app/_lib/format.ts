// Formatting shared by server-rendered pages and the client-side live view.
// Everything here is deterministic and UTC-pinned: the ISR pages are rendered
// once and served to every timezone, so a locale-dependent format would
// hydrate differently than it rendered.

const UTC_DATE = new Intl.DateTimeFormat("en-GB", {
  timeZone: "UTC",
  year: "numeric",
  month: "short",
  day: "2-digit",
});

const UTC_TIME = new Intl.DateTimeFormat("en-GB", {
  timeZone: "UTC",
  hour: "2-digit",
  minute: "2-digit",
  hour12: false,
});

export function formatUtc(iso: string | null): string {
  if (!iso) return "—";
  const date = new Date(iso);
  if (Number.isNaN(date.getTime())) return "—";
  return `${UTC_DATE.format(date)} · ${UTC_TIME.format(date)}Z`;
}

export function formatDuration(ms: number | null): string {
  if (ms === null || Number.isNaN(ms)) return "—";
  if (ms < 1000) return `${Math.round(ms)}ms`;
  const seconds = ms / 1000;
  if (seconds < 60) return `${seconds.toFixed(seconds < 10 ? 2 : 1)}s`;
  const minutes = Math.floor(seconds / 60);
  return `${minutes}m ${Math.round(seconds % 60)
    .toString()
    .padStart(2, "0")}s`;
}

/** Elapsed wall-clock for a run that is still going. Client-side only. */
export function formatElapsed(fromIso: string | null, nowMs: number): string {
  if (!fromIso) return "—";
  const started = new Date(fromIso).getTime();
  if (Number.isNaN(started)) return "—";
  return formatDuration(Math.max(0, nowMs - started));
}

export function formatPercent(ratio: number): string {
  return `${Math.round(ratio * 100)}%`;
}
