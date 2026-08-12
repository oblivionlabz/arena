# app/api/

Route handlers per `docs/API.md` — that document states every route's
contract and who calls it (public / internal / cron-only), which determines
whether Firewall rate-limiting and strict input validation are mandatory.
Owned by the `api/` worktree, depends on `db/` landing first.
