import { neon } from "@neondatabase/serverless";
import { drizzle } from "drizzle-orm/neon-http";
import { migrate } from "drizzle-orm/neon-http/migrator";

import { seed } from "../../src/db/seed";

/** Migrates and seeds the test branch once before the db test run. */
export default async function setup() {
  const url = process.env.TEST_DATABASE_URL;
  if (!url) {
    // Where the db tests must run (e.g. CI), skipping them would read as a pass.
    if (process.env.REQUIRE_DB_TESTS === "1")
      throw new Error("REQUIRE_DB_TESTS=1 but TEST_DATABASE_URL is not set.");
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
