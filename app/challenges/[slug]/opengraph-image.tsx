// docs/WORKFLOWS.md step 5b / docs/ARCHITECTURE.md's "OG Image gen
// (@vercel/og, scorecards)" — Next.js's file-convention route, generated
// on-demand (and edge-cached) whenever this challenge's URL gets unfurled,
// not proactively rendered and stored by the Workflow. docs/DATA_MODEL.md is
// explicit that Blob writes happen in exactly one place (an attempt result);
// this file deliberately isn't a second one.
import { ImageResponse } from "next/og";

import { fetchChallenge } from "@/app/_lib/api";
import { modelColorHex } from "@/app/_lib/model-color";

export const alt = "Arena challenge scorecard";
export const size = { width: 1200, height: 630 };
export const contentType = "image/png";

const VOID = "#0a0b0d";
const SURFACE = "#101218";
const INK = "#e7eaf0";
const MUTED = "#8890a0";
const DIM = "#59606f";
const LINE = "rgba(231, 234, 240, 0.14)";
const ACCENT = "#2f7bff";
const ACCENT_HOT = "#6ba4ff";
const FAIL = "#c05762";

const FONT_STACK = "ui-monospace, Menlo, Consolas, monospace";

function shell(children: React.ReactNode) {
  return new ImageResponse(
    (
      <div
        style={{
          width: "100%",
          height: "100%",
          display: "flex",
          flexDirection: "column",
          background: VOID,
          color: INK,
          fontFamily: FONT_STACK,
          padding: "64px 72px",
        }}
      >
        {children}
      </div>
    ),
    size,
  );
}

function eyebrow(text: string, color = DIM) {
  return (
    <div
      style={{
        display: "flex",
        fontSize: 22,
        letterSpacing: 6,
        textTransform: "uppercase",
        color,
      }}
    >
      {text}
    </div>
  );
}

export default async function Image({ params }: { params: Promise<{ slug: string }> }) {
  const { slug } = await params;
  // Same rule as the page and its API route: a pending/rejected challenge is
  // invisible everywhere else on the site (docs/SECURITY.md's moderation
  // gate) — an unfurled share card is not an exception to that.
  const detail = await fetchChallenge(slug);

  if (!detail) {
    return shell(
      <div
        style={{
          display: "flex",
          flexDirection: "column",
          justifyContent: "center",
          height: "100%",
          gap: 16,
        }}
      >
        {eyebrow("ARENA")}
        <div style={{ display: "flex", fontSize: 56, fontWeight: 700, color: MUTED }}>
          Nothing here.
        </div>
      </div>,
    );
  }

  const { challenge, runs } = detail;
  const completed = challenge.status === "completed";
  const solved = runs.filter((r) => r.status === "passed").length;
  // Six rows fit this card's height without crowding; anything past that is
  // still on the challenge-detail page itself.
  const shown = runs.slice(0, 6);

  return shell(
    <div style={{ display: "flex", flexDirection: "column", height: "100%" }}>
      <div style={{ display: "flex", justifyContent: "space-between", alignItems: "center" }}>
        {eyebrow("ARENA")}
        {eyebrow(
          completed ? "RACE COMPLETE" : "RACE IN PROGRESS",
          completed ? ACCENT_HOT : MUTED,
        )}
      </div>

      <div
        style={{
          display: "flex",
          fontSize: 52,
          fontWeight: 700,
          letterSpacing: -1.5,
          lineHeight: 1.08,
          marginTop: 28,
          maxWidth: 1000,
        }}
      >
        {challenge.title}
      </div>

      <div style={{ display: "flex", gap: 40, marginTop: 24, fontSize: 22, color: MUTED }}>
        <div style={{ display: "flex", gap: 10 }}>
          <span style={{ color: DIM }}>Language</span>
          <span>{challenge.language}</span>
        </div>
        {completed && (
          <div style={{ display: "flex", gap: 10 }}>
            <span style={{ color: DIM }}>Solved</span>
            <span style={{ color: ACCENT_HOT }}>
              {solved}/{runs.length}
            </span>
          </div>
        )}
      </div>

      {shown.length > 0 && (
        <div style={{ display: "flex", flexDirection: "column", gap: 10, marginTop: 36 }}>
          {shown.map((run) => (
            <div
              key={run.id}
              style={{
                display: "flex",
                alignItems: "center",
                justifyContent: "space-between",
                background: SURFACE,
                border: `1px solid ${LINE}`,
                borderLeft: `3px solid ${runAccent(run.status)}`,
                padding: "14px 22px",
                fontSize: 24,
              }}
            >
              <span style={{ display: "flex", alignItems: "center", gap: 10, fontWeight: 700 }}>
                <span
                  style={{
                    display: "flex",
                    width: 10,
                    height: 10,
                    borderRadius: "50%",
                    background: modelColorHex(run.model.slug),
                  }}
                />
                {run.model.displayName}
              </span>
              <span style={{ display: "flex", color: runAccent(run.status), fontSize: 18, letterSpacing: 2, textTransform: "uppercase" }}>
                {run.status}
              </span>
            </div>
          ))}
        </div>
      )}

      <div style={{ display: "flex", flex: 1 }} />

      <div style={{ display: "flex", fontSize: 18, letterSpacing: 3, textTransform: "uppercase", color: DIM }}>
        Every answer runs for real before it scores.
      </div>
    </div>,
  );
}

function runAccent(status: string): string {
  if (status === "passed") return ACCENT;
  if (status === "failed" || status === "error") return FAIL;
  return DIM;
}
