// docs/WORKFLOWS.md step 5c — the Discord digest, fired once per completed
// challenge. docs/ARCHITECTURE.md and .env.example both describe this as a
// Vercel Connect integration; Connect's connector types (api-key, github,
// linear, oauth, photon, salesforce, slack, snowflake — confirmed against
// the live product, not assumed) don't include Discord, so there's no native
// connector to request a short-lived token from. A Discord Incoming Webhook
// is the pragmatic substitute: scoped to exactly one channel and revocable
// from Discord's own side, which covers the spirit of docs/SECURITY.md's
// "don't hold a standing broad credential" concern even though it's a plain
// env var rather than a Connect-issued token. If Discord ever ships as a
// real Connect connector type, this is the file to replace.
export interface DigestRun {
  modelDisplayName: string;
  status: "passed" | "failed" | "error";
  attemptsUsed: number;
  timeToSolveMs: number | null;
}

export interface DigestPayload {
  challengeSlug: string;
  challengeTitle: string;
  language: string;
  runs: DigestRun[];
  /** e.g. https://arena.example.com — no trailing slash. */
  siteUrl: string;
}

const STATUS_EMOJI: Record<DigestRun["status"], string> = {
  passed: "✅",
  failed: "❌",
  error: "⚠️",
};

function formatDuration(ms: number | null): string {
  if (ms === null) return "—";
  return `${(ms / 1000).toFixed(1)}s`;
}

function buildContent(payload: DigestPayload): string {
  const solved = payload.runs.filter((r) => r.status === "passed").length;
  const lines = payload.runs
    .map(
      (r) =>
        `${STATUS_EMOJI[r.status]} **${r.modelDisplayName}** — ${r.status} (${r.attemptsUsed} attempt${r.attemptsUsed === 1 ? "" : "s"}, ${formatDuration(r.timeToSolveMs)})`,
    )
    .join("\n");

  return [
    `**${payload.challengeTitle}** — race complete`,
    `${solved}/${payload.runs.length} models solved it · ${payload.language}`,
    "",
    lines,
    "",
    `${payload.siteUrl}/challenges/${payload.challengeSlug}`,
  ].join("\n");
}

/**
 * Fire-and-report, not fire-and-forget: the caller (a `"use step"` function,
 * see lib/workflow/steps/digest.ts) decides what a failed post means for the
 * step's own retry/failure semantics. This function never throws for an
 * unconfigured webhook — a missing digest is a worse silent failure than a
 * loud one, so it's surfaced as a return value the caller must look at.
 */
export async function sendDigest(
  payload: DigestPayload,
): Promise<{ ok: true } | { ok: false; reason: string }> {
  const webhookUrl = process.env.DISCORD_WEBHOOK_URL;
  if (!webhookUrl) {
    return { ok: false, reason: "DISCORD_WEBHOOK_URL is not set." };
  }

  const response = await fetch(webhookUrl, {
    method: "POST",
    headers: { "content-type": "application/json" },
    body: JSON.stringify({
      content: buildContent(payload),
      // Discord fetches this itself; no need to attach the PNG bytes.
      embeds: [
        {
          image: {
            url: `${payload.siteUrl}/challenges/${payload.challengeSlug}/opengraph-image`,
          },
        },
      ],
    }),
  });

  if (!response.ok) {
    const body = await response.text().catch(() => "");
    return { ok: false, reason: `Discord webhook responded HTTP ${response.status}: ${body}` };
  }

  return { ok: true };
}
