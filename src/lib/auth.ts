import "server-only";

import { betterAuth } from "better-auth";
import { drizzleAdapter } from "better-auth/adapters/drizzle";

import { db } from "@/db";
import * as authSchema from "@/db/auth-schema";
import { adapterOptions, authOptions } from "@/lib/auth-options";

/**
 * Better Auth server instance. Secret and base URL come from
 * BETTER_AUTH_SECRET / BETTER_AUTH_URL. Options live in `auth-options.ts`;
 * after changing them run `npm run auth:generate` then `npm run db:generate`.
 */
export const auth = betterAuth({
  ...authOptions,
  database: drizzleAdapter(db, { ...adapterOptions, schema: authSchema }),
});

export type Session = typeof auth.$Infer.Session;
