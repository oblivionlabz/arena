// Run with: pnpm db:migrate (requires DATABASE_URL, e.g. via `vercel env pull`)
import { neon } from "@neondatabase/serverless";
import { drizzle } from "drizzle-orm/neon-http";
import { migrate } from "drizzle-orm/neon-http/migrator";

async function main() {
  const databaseUrl = process.env.DATABASE_URL;
  if (!databaseUrl) {
    throw new Error("DATABASE_URL is not set — pull it with `vercel env pull .env.local` first.");
  }
  const db = drizzle(neon(databaseUrl));
  await migrate(db, { migrationsFolder: "./db/migrations" });
  console.log("Migrations applied.");
}

main().catch((err) => {
  console.error(err);
  process.exit(1);
});
