import type { BetterAuthOptions } from "better-auth";
import { nextCookies } from "better-auth/next-js";
import { admin } from "better-auth/plugins/admin";

import { PASSWORD_MAX_LENGTH, PASSWORD_MIN_LENGTH } from "./auth-validation";

/**
 * Everything about auth except the database, shared by the app instance
 * (`auth.ts`) and the schema-generation instance (`auth.cli.ts`) so the
 * generated tables always match the plugins in use.
 */
export const authOptions = {
  appName: "Corvo",
  emailAndPassword: {
    enabled: true,
    // Same limits the forms validate against.
    minPasswordLength: PASSWORD_MIN_LENGTH,
    maxPasswordLength: PASSWORD_MAX_LENGTH,
    autoSignIn: true,
  },
  session: {
    expiresIn: 60 * 60 * 24 * 30, // 30 days
    updateAge: 60 * 60 * 24, // extend at most once a day while in use
  },
  // nextCookies must stay last so Server Actions can set the session cookie.
  plugins: [admin(), nextCookies()],
} satisfies BetterAuthOptions;

/** Drizzle adapter options; tables are plural like the catalog tables. */
export const adapterOptions = { provider: "pg", usePlural: true } as const;
