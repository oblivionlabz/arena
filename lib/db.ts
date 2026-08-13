// Shared Neon Postgres client for the read routes under app/api/.
// Same neon-http driver pattern as db/migrate.ts.
import { neon } from "@neondatabase/serverless";
import { drizzle, type NeonHttpDatabase } from "drizzle-orm/neon-http";

let client: NeonHttpDatabase | undefined;

// Lazy: route modules get imported during `next build`'s route collection, where
// DATABASE_URL isn't necessarily present. Connecting at import time would turn
// that into a build failure instead of a request-time one.
export function db(): NeonHttpDatabase {
  if (!client) {
    const databaseUrl = process.env.DATABASE_URL;
    if (!databaseUrl) {
      throw new Error("DATABASE_URL is not set — pull it with `vercel env pull .env.local` first.");
    }
    client = drizzle(neon(databaseUrl));
  }
  return client;
}
