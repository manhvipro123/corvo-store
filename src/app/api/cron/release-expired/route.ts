import { timingSafeEqual } from "node:crypto";

import { pruneRateLimits } from "@/db/rate-limit";
import { releaseStalePendingOrders } from "@/lib/checkout-session";

/**
 * Scheduled sweep of checkouts that ended without their `expired` webhook
 * (see `releaseStalePendingOrders`). Called by Vercel Cron (`vercel.json`),
 * which sends `Authorization: Bearer $CRON_SECRET`; any other scheduler can
 * call it the same way. Not behind the proxy: the secret is its auth.
 * Also drops old auth rate-limit counters, the only other periodic cleanup.
 */
export async function GET(request: Request) {
  const secret = process.env.CRON_SECRET;
  if (!secret) {
    // Our misconfiguration, not a bad request: say so in the logs and the
    // cron dashboard instead of looking like a wrong secret.
    console.error("[cron] CRON_SECRET is not set");
    return new Response("Cron not configured", { status: 500 });
  }
  if (!authorized(request.headers.get("authorization"), secret))
    return new Response("Unauthorized", { status: 401 });

  const result = await releaseStalePendingOrders();
  await pruneRateLimits();
  return Response.json(result);
}

function authorized(header: string | null, secret: string) {
  if (!header) return false;
  const expected = Buffer.from(`Bearer ${secret}`);
  const given = Buffer.from(header);
  return given.length === expected.length && timingSafeEqual(given, expected);
}
