// docs/ARCHITECTURE.md's Flags: "Two live toggles that matter operationally,
// not decoration: which models are active in the day's rotation, and a
// 'chaos mode' flag [...] Both are flippable from the Vercel Toolbar without
// a deploy." — docs/PRODUCT.md's operator story is explicit this is
// Flags-driven, not just "an admin edits a DB row," so `vercelAdapter()` is
// what actually buys the "without a deploy" part: it's Vercel's own managed
// storage behind the flag, editable from the Toolbar, read here via OIDC
// (this app's Vercel OIDC token) with no separate connection string needed.
//
// Neither flag is read live inside the Workflow itself — `lib/workflow/` is
// the `workflow/` worktree's file, and its `"use workflow"` functions run in
// a sandboxed VM without the Node APIs this SDK needs anyway (see
// lib/workflow/README.md). Both flags are read once, by
// app/api/cron/rotate-challenge/route.ts, right before it starts a cycle —
// see that file for how each one's value gets applied without touching
// workflow/'s code.
import { flag } from "flags/next";
import { vercelAdapter } from "@flags-sdk/vercel";

/**
 * Model slugs force-excluded from the next rotation, regardless of their
 * `models.active` column in Postgres. A single array-valued flag rather than
 * one flag per model: the model roster is DB-driven and can grow, and a
 * static flag per row would need a code change (a deploy) every time a model
 * is added — the opposite of what this flag exists for.
 */
export const pausedModelSlugs = flag<string[]>({
  key: "paused-model-slugs",
  adapter: vercelAdapter(),
  defaultValue: [],
  description: "Model slugs to pull from the next rotation without a deploy.",
});

/**
 * Pre-release QA mode: docs/ARCHITECTURE.md's "swaps in a deliberately
 * adversarial test case for pre-release QA of scoring logic." Implemented as
 * "prefer the reserved chaos-QA challenge over the normal FIFO queue," not as
 * a live substitution of whatever challenge would have run next — swapping a
 * real, publicly-submitted challenge's stored test cases out from under it
 * for one cycle would corrupt that row, and there's no scratch space to
 * restore it from afterward.
 */
export const chaosMode = flag<boolean>({
  key: "chaos-mode",
  adapter: vercelAdapter(),
  defaultValue: false,
  options: [
    { label: "Off", value: false },
    { label: "On — run the QA challenge instead", value: true },
  ],
  description: "Run the reserved adversarial QA challenge instead of the normal queue.",
});
