import "server-only";

import { neon } from "@neondatabase/serverless";
import { drizzle } from "drizzle-orm/neon-http";

import * as schema from "@/db/schema";

if (!process.env.DATABASE_URL) {
  throw new Error("DATABASE_URL is not set.");
}

/**
 * Neon over HTTP: no connection pool to manage. Interactive transactions
 * aren't supported; use `db.batch()` for atomic multi-statement writes.
 */
export const db = drizzle(neon(process.env.DATABASE_URL), { schema });
