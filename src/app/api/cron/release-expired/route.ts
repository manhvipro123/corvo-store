import { timingSafeEqual } from "node:crypto";

import { releaseStalePendingOrders } from "@/lib/checkout-session";

/**
 * Scheduled sweep of checkouts that ended without their `expired` webhook
 * (see `releaseStalePendingOrders`). Called by Vercel Cron (`vercel.json`),
 * which sends `Authorization: Bearer $CRON_SECRET`; any other scheduler can
 * call it the same way. Not behind the proxy: the secret is its auth.
 */
export async function GET(request: Request) {
  if (!authorized(request.headers.get("authorization")))
    return new Response("Unauthorized", { status: 401 });

  const result = await releaseStalePendingOrders();
  return Response.json(result);
}

function authorized(header: string | null) {
  const secret = process.env.CRON_SECRET;
  if (!secret || !header) return false;
  const expected = Buffer.from(`Bearer ${secret}`);
  const given = Buffer.from(header);
  return given.length === expected.length && timingSafeEqual(given, expected);
}
