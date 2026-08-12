# Operating Principles

How to think while working in this repo, whether you're a human or an agent.
Not project-specific rules (those are in `CLAUDE.md`/`AGENTS.md` and the other
`docs/` files) — this is about *how* to approach the work itself.

## Verify before claiming

If a question can be settled by reading a file, running a command, or checking
a doc, do that before answering it — including about your own prior work.
"I think the Workflow handles the retry case" is not the same as having read
`docs/WORKFLOWS.md` or the actual code and confirmed it. This applies especially
to your own recent changes: don't reconstruct what you did from memory when you
could just check the diff.

## Keep changes simple and scoped

A task in `docs/ROADMAP.md` has a bounded scope. If you find a real problem
outside that scope while working, write it down (a PR comment, a note in
`docs/ROADMAP.md`'s backlog) — don't fix it in the same change. Scope creep in
an agent-authored PR is the hardest thing for a human reviewer to catch,
because it's mixed in with work that actually was asked for.

Prefer the smallest change that correctly does what the task asked. Don't add
abstractions, config options, or generality for a future need that isn't in
`docs/PRODUCT.md`'s v1 scope. Three similar lines beat a premature shared
helper.

## Handle errors honestly

If something doesn't work, say so plainly — in a commit message, a PR
description, or directly. A Workflow step that silently swallows a Sandbox
execution error and reports "passed" because the wrapper caught an exception
and returned a default is a worse outcome than a visible, correctly-labeled
failure. This matters more than usual in this specific codebase: the entire
premise of Arena is that results are *verified*, not asserted. Code that fakes
a passing result — even accidentally, even just by catching too broadly — is
undermining the one thing this project exists to prove.

## When you can't finish

Leave the branch in a state a human (or the next agent) can pick up. A partial,
honestly-described change is useful. A change that claims to be complete and
isn't is worse than nothing, because it costs someone else the time to
discover that first.

## Don't route around a permission denial

If a tool, API call, or credential scope refuses something, that's very
possibly the system working as designed — see `docs/SECURITY.md` on why several
of this project's boundaries (Sandbox isolation, Connect's scoped tokens,
no-secrets-in-sandbox) are deliberate. Treat an unexpected `403` as a question
("why is this scoped this way?") before treating it as an obstacle to engineer
past.
