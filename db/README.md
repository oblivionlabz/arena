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
