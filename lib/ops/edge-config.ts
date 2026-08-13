// Edge Config writes — docs/DATA_MODEL.md's "written exactly once a day, by
// the Cron-triggered rotation step". `@vercel/edge-config` (the `EDGE_CONFIG`
// connection string every other route in this app reads with) is read-only by
// design; Edge Config is a team-level resource, so writing to it needs a
// full Vercel API token, which is a materially different credential class
// than anything else this app holds — see the PR this file shipped in for
// why. `EDGE_CONFIG_WRITE_TOKEN` is optional on purpose: until that token is
// provisioned, rotation still selects a challenge and starts the Workflow,
// it just can't flip the pointer the public site reads — see the caller.
const GLOBAL_CONFIG_API = "https://api.vercel.com/v1/global-config";

// Not a secret — a team ID is an account identifier, not a credential (same
// class as VERCEL_PROJECT_ID, which Vercel auto-injects; VERCEL_TEAM_ID isn't
// one of the system env vars Vercel exposes, so it's a literal here rather
// than an env var this project would otherwise have to invent and keep in
// sync with .env.example for no security benefit).
const TEAM_ID = "team_NyjuPYSDDocCe4djJUeqTFFj";

interface EdgeConfigItem {
  operation: "upsert" | "delete";
  key: string;
  value?: unknown;
}

export class EdgeConfigNotConfigured extends Error {
  constructor() {
    super("EDGE_CONFIG_WRITE_TOKEN is not set — Edge Config was not updated.");
    this.name = "EdgeConfigNotConfigured";
  }
}

function edgeConfigIdFromConnectionString(connectionString: string): string {
  const match = /edge-config\.vercel\.com\/(ecfg_[a-z0-9]+)/i.exec(connectionString);
  if (!match) {
    throw new Error("EDGE_CONFIG connection string is not in the expected format.");
  }
  return match[1];
}

async function patchItems(items: EdgeConfigItem[]): Promise<void> {
  const writeToken = process.env.EDGE_CONFIG_WRITE_TOKEN;
  const connectionString = process.env.EDGE_CONFIG;

  if (!writeToken) throw new EdgeConfigNotConfigured();
  if (!connectionString) throw new Error("EDGE_CONFIG is not set.");

  const edgeConfigId = edgeConfigIdFromConnectionString(connectionString);
  const url = new URL(`${GLOBAL_CONFIG_API}/${edgeConfigId}/items`);
  url.searchParams.set("teamId", TEAM_ID);

  const response = await fetch(url, {
    method: "PATCH",
    headers: {
      authorization: `Bearer ${writeToken}`,
      "content-type": "application/json",
    },
    body: JSON.stringify({ items }),
  });

  if (!response.ok) {
    const body = await response.text().catch(() => "");
    throw new Error(`Edge Config write failed: HTTP ${response.status} ${body}`);
  }
}

/** The one write docs/DATA_MODEL.md's Edge Config document ever gets: the daily rotation. */
export async function setActiveChallenge(challengeId: string, startedAt: string): Promise<void> {
  await patchItems([
    { operation: "upsert", key: "active_challenge_id", value: challengeId },
    { operation: "upsert", key: "active_challenge_started_at", value: startedAt },
  ]);
}
