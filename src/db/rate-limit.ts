import "server-only";

import { sql } from "drizzle-orm";

import { db } from "@/db";
import { rateLimits } from "@/db/schema";

export type RateLimitRule = { max: number; windowSeconds: number };

/**
 * Counts one attempt against `key` and returns whether it is within
 * `rule.max` for the current fixed window (a new window starts with the
 * first attempt after the last one ended). One upsert, so concurrent
 * attempts can't all pass on the same stale count.
 */
export async function consumeRateLimit(key: string, rule: RateLimitRule) {
  const ended = sql`${rateLimits}.window_start <= now() - make_interval(secs => ${rule.windowSeconds})`;
  const { rows } = await db.execute<{ count: number }>(sql`
    insert into ${rateLimits} (key, count, window_start)
    values (${key}, 1, now())
    on conflict (key) do update set
      count = case when ${ended} then 1 else ${rateLimits}.count + 1 end,
      window_start = case when ${ended} then now() else ${rateLimits}.window_start end
    returning count
  `);
  return Number(rows[0].count) <= rule.max;
}

/** Deletes counters whose window ended over a day ago (longer than any rule). */
export async function pruneRateLimits() {
  await db.execute(sql`
    delete from ${rateLimits} where window_start < now() - interval '1 day'
  `);
}
