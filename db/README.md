# db/

Postgres migrations, matching `docs/DATA_MODEL.md`. Owned by the `schema/`
worktree — see `docs/DEVELOPMENT.md` for the worktree split and merge order
(this lands first; `workflow/` and `api/` depend on it).

Pick a migration tool during `M0` (e.g. `drizzle-kit`, `node-pg-migrate`) and
document the actual choice + how to run migrations here once decided — this
file is a placeholder, not a decision.
