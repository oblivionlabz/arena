// Drizzle schema — mirrors docs/DATA_MODEL.md exactly. That doc is the spec;
// this file is its Drizzle-native expression. Keep them in sync.
import { sql } from "drizzle-orm";
import {
  boolean,
  index,
  integer,
  jsonb,
  pgTable,
  text,
  timestamp,
  uuid,
} from "drizzle-orm/pg-core";

export const challenges = pgTable("challenges", {
  id: uuid("id").primaryKey().default(sql`gen_random_uuid()`),
  slug: text("slug").notNull().unique(),
  title: text("title").notNull(),
  prompt: text("prompt").notNull(),
  testCases: jsonb("test_cases").notNull(),
  language: text("language").notNull().default("python"),
  status: text("status").notNull().default("pending"), // pending | approved | rejected | active | completed
  submittedBy: text("submitted_by"),
  createdAt: timestamp("created_at", { withTimezone: true })
    .notNull()
    .defaultNow(),
  activatedAt: timestamp("activated_at", { withTimezone: true }),
  completedAt: timestamp("completed_at", { withTimezone: true }),
});

export const models = pgTable("models", {
  id: uuid("id").primaryKey().default(sql`gen_random_uuid()`),
  slug: text("slug").notNull().unique(),
  gatewayModel: text("gateway_model").notNull(),
  displayName: text("display_name").notNull(),
  active: boolean("active").notNull().default(true),
  createdAt: timestamp("created_at", { withTimezone: true })
    .notNull()
    .defaultNow(),
});

export const runs = pgTable(
  "runs",
  {
    id: uuid("id").primaryKey().default(sql`gen_random_uuid()`),
    challengeId: uuid("challenge_id")
      .notNull()
      .references(() => challenges.id),
    modelId: uuid("model_id")
      .notNull()
      .references(() => models.id),
    status: text("status").notNull().default("queued"), // queued | running | passed | failed | error
    attemptsUsed: integer("attempts_used").notNull().default(0),
    maxAttempts: integer("max_attempts").notNull().default(3),
    timeToSolveMs: integer("time_to_solve_ms"),
    blobKey: text("blob_key"),
    startedAt: timestamp("started_at", { withTimezone: true }),
    finishedAt: timestamp("finished_at", { withTimezone: true }),
    workflowRunId: text("workflow_run_id"),
  },
  (table) => [
    index("runs_challenge_idx").on(table.challengeId),
    index("runs_model_idx").on(table.modelId),
  ],
);
