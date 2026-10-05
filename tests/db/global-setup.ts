import { neon } from "@neondatabase/serverless";
import { config } from "dotenv";
import { drizzle } from "drizzle-orm/neon-http";
import { migrate } from "drizzle-orm/neon-http/migrator";

import { seed } from "../../src/db/seed";

/** Migrates and seeds the test branch once before the db test run. */
export default async function setup() {
  config({ path: ".env.local", quiet: true });
  const url = process.env.TEST_DATABASE_URL;
  if (!url) {
    console.warn("TEST_DATABASE_URL not set: database tests will be skipped.");
    return;
  }
  // Seeding truncates tables: never point it at the app database.
  if (url === process.env.DATABASE_URL) {
    throw new Error(
      "TEST_DATABASE_URL must differ from DATABASE_URL (use a separate Neon branch).",
    );
  }

  await migrate(drizzle(neon(url)), { migrationsFolder: "drizzle" });
  await seed(url);
}
