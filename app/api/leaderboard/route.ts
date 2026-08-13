// GET /api/leaderboard — docs/API.md, consumed at ISR revalidation time.
// Aggregation happens in Postgres, not here: docs/DATA_MODEL.md is explicit that
// the runs/models join is why Postgres is in this stack at all.
import { sql } from "drizzle-orm";

import { db } from "@/lib/db";

interface LeaderboardRow {
  slug: string;
  displayName: string;
  active: boolean;
  totalRuns: number;
  wins: number;
  winRate: number;
  avgTimeToSolveMs: number | null;
  currentStreak: number;
}

// Two deliberate exclusions:
//   - 'error' runs (provider/infrastructure failure, not the model getting it
//     wrong) don't count for or against a model, streaks included.
//   - runs belonging to a challenge that hasn't completed. Per
//     docs/WORKFLOWS.md, individual branches settle before the challenge does,
//     so counting them would let a half-finished race move historical standings.
const LEADERBOARD_QUERY = sql`
  with settled as (
    select
      r.model_id,
      r.status,
      r.time_to_solve_ms,
      row_number() over (
        partition by r.model_id
        order by c.completed_at desc nulls last, r.finished_at desc nulls last
      ) as rn
    from runs r
    join challenges c on c.id = r.challenge_id
    where r.status in ('passed', 'failed')
      and c.status = 'completed'
  ),
  agg as (
    select
      model_id,
      count(*)::int as total_runs,
      count(*) filter (where status = 'passed')::int as wins,
      avg(time_to_solve_ms) filter (where status = 'passed') as avg_ms,
      -- Leading run of 'passed' rows from the most recent settled run backwards.
      (coalesce(min(rn) filter (where status <> 'passed'), count(*) + 1) - 1)::int as current_streak
    from settled
    group by model_id
  )
  select
    m.slug,
    m.display_name as "displayName",
    m.active,
    coalesce(a.total_runs, 0) as "totalRuns",
    coalesce(a.wins, 0) as wins,
    coalesce((a.wins::numeric / nullif(a.total_runs, 0))::float8, 0) as "winRate",
    round(a.avg_ms)::int as "avgTimeToSolveMs",
    coalesce(a.current_streak, 0) as "currentStreak"
  from models m
  left join agg a on a.model_id = m.id
  order by "winRate" desc, "avgTimeToSolveMs" asc nulls last, m.display_name asc
`;

export async function GET() {
  const result = await db().execute(LEADERBOARD_QUERY);
  return Response.json(
    { models: result.rows as unknown as LeaderboardRow[] },
    {
      // Explicit, because docs/API.md's contract is that this must not become a
      // per-visitor DB hit. Standings only move when a challenge completes
      // (at most daily), so a shared-cache window costs nothing in freshness.
      headers: { "cache-control": "public, s-maxage=60, stale-while-revalidate=300" },
    },
  );
}
