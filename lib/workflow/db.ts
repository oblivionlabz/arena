import { neon } from "@neondatabase/serverless";
import { drizzle } from "drizzle-orm/neon-http";

import * as schema from "@/db/schema";

// neon-http, matching db/migrate.ts: every caller here is a `"use step"`
// function, i.e. a fresh short-lived invocation with no connection to pool.
export function getDb() {
  const databaseUrl = process.env.DATABASE_URL;
  if (!databaseUrl) {
    throw new Error("DATABASE_URL is not set — pull it with `vercel env pull .env.local` first.");
  }
  return drizzle(neon(databaseUrl), { schema });
}
