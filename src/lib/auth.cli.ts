/**
 * Only for `npm run auth:generate`: the Better Auth CLI can't load files
 * that import "server-only", so it reads this instance instead. It never
 * connects; the schema depends only on the shared options.
 */
import { neon } from "@neondatabase/serverless";
import { betterAuth } from "better-auth";
import { drizzleAdapter } from "better-auth/adapters/drizzle";
import { drizzle } from "drizzle-orm/neon-http";

import { adapterOptions, authOptions } from "./auth-options";

export const auth = betterAuth({
  ...authOptions,
  secret: "schema-generation-only-not-a-real-secret",
  database: drizzleAdapter(
    drizzle(neon("postgresql://schema-generation@localhost/none")),
    adapterOptions,
  ),
});
