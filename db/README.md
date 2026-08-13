# db/

Postgres migrations, matching `docs/DATA_MODEL.md`. Owned by the `schema/`
worktree — see `docs/DEVELOPMENT.md` for the worktree split and merge order
(this lands first; `workflow/` and `api/` depend on it).

## Migration tool: `drizzle-kit`

**Decision made during `M0`.** Chosen over `node-pg-migrate` because this repo
already depends on `@neondatabase/serverless`, and Drizzle's `neon-http`
driver is the natural fit for Neon's HTTP-based serverless connections used
from Vercel Functions/Workflows (no persistent connection pool to manage,
which matters in a serverless/edge-adjacent runtime). `schema.ts` is the
source of truth; SQL migrations are generated from it, not hand-written.

- `schema.ts` — Drizzle table definitions, a direct mirror of
  `docs/DATA_MODEL.md`'s SQL. Keep them in sync; if they drift, `DATA_MODEL.md`
  is still the spec and `schema.ts` is wrong.
- `migrations/` — generated SQL migrations + Drizzle's snapshot metadata.
  Never hand-edit a migration file already applied to any environment.
- `migrate.ts` — applies pending migrations against `DATABASE_URL`.

## Running migrations

```bash
pnpm db:generate   # after changing db/schema.ts, generates a new SQL migration
vercel env pull .env.local   # get a real DATABASE_URL
pnpm db:migrate    # applies pending migrations
```

## Seeding

`seed.ts` inserts one `models` row and one `approved` `challenges` row so a
benchmark run has something real to execute against. Idempotent — re-running
updates by slug rather than duplicating. Added by the `workflow/` worktree so
`benchmarkChallenge()` could be triggered manually per `docs/ROADMAP.md`'s M1
exit criteria.

```bash
pnpm db:seed       # prints the seeded model and challenge IDs
```
