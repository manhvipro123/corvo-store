import "server-only";

import { createHash } from "node:crypto";

import { getIP } from "better-auth/api";

import { consumeRateLimit, type RateLimitRule } from "@/db/rate-limit";
import { authOptions } from "@/lib/auth-options";

export const TOO_MANY_ATTEMPTS =
  "Too many attempts. Please wait a few minutes and try again.";

type AuthAction = "sign-in" | "sign-up" | "change-password";

/** Per client IP and per account (email, or user id when signed in). */
const RULES: Record<
  AuthAction,
  { ip?: RateLimitRule; account: RateLimitRule }
> = {
  "sign-in": {
    ip: { max: 20, windowSeconds: 5 * 60 },
    account: { max: 10, windowSeconds: 15 * 60 },
  },
  "sign-up": {
    ip: { max: 10, windowSeconds: 15 * 60 },
    account: { max: 5, windowSeconds: 15 * 60 },
  },
  "change-password": { account: { max: 5, windowSeconds: 15 * 60 } },
};

const hashed = (value: string) =>
  createHash("sha256").update(value).digest("hex");

/**
 * Counts this attempt and returns true if it is over a limit. Better Auth
 * rate-limits only requests to its HTTP handler, and our auth flows call
 * `auth.api.*` from Server Actions, which skips that, so every action that
 * checks a password calls this first. The IP comes from Better Auth's
 * trusted headers; without one only the per-account limit applies (a shared
 * bucket would lock everyone out at once).
 */
export async function tooManyAttempts(
  action: AuthAction,
  { headers, account }: { headers: Headers; account: string },
) {
  const rules = RULES[action];
  const ip = getIP(headers, authOptions);
  const checks = [
    consumeRateLimit(
      `${action}:account:${hashed(account.toLowerCase())}`,
      rules.account,
    ),
  ];
  if (rules.ip && ip)
    checks.push(consumeRateLimit(`${action}:ip:${ip}`, rules.ip));
  return (await Promise.all(checks)).some((allowed) => !allowed);
}
