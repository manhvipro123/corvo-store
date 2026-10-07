import { neon } from "@neondatabase/serverless";
import { afterAll, beforeAll, describe, expect, it } from "vitest";

const url = process.env.TEST_DATABASE_URL;

describe.skipIf(!url)("auth rate limits (test database)", () => {
  // Loaded in a hook: src/db/index.ts throws without a database URL.
  let limits: typeof import("@/db/rate-limit");
  const sql = neon(url ?? "postgresql://skipped@localhost/none");
  const prefix = `rate-limit-test-${crypto.randomUUID().slice(0, 8)}`;
  const rule = { max: 3, windowSeconds: 60 };

  beforeAll(async () => {
    limits = await import("@/db/rate-limit");
  });

  afterAll(async () => {
    if (!url) return;
    await sql`delete from rate_limits where key like ${`${prefix}%`}`;
  });

  it("allows `max` attempts per window, then refuses, even when they arrive at once", async () => {
    const key = `${prefix}:burst`;
    const results = await Promise.all(
      Array.from({ length: 5 }, () => limits.consumeRateLimit(key, rule)),
    );
    expect(results.filter(Boolean)).toHaveLength(3);
    expect(await limits.consumeRateLimit(key, rule)).toBe(false);
  });

  it("starts a new window once the last one ended", async () => {
    const key = `${prefix}:window`;
    for (let i = 0; i < 4; i++) await limits.consumeRateLimit(key, rule);
    expect(await limits.consumeRateLimit(key, rule)).toBe(false);

    await sql`update rate_limits set window_start = now() - interval '61 seconds' where key = ${key}`;
    expect(await limits.consumeRateLimit(key, rule)).toBe(true);
    const [row] = await sql`select count from rate_limits where key = ${key}`;
    expect(row.count).toBe(1);
  });

  it("keeps keys apart", async () => {
    for (let i = 0; i < 4; i++)
      await limits.consumeRateLimit(`${prefix}:a`, rule);
    expect(await limits.consumeRateLimit(`${prefix}:b`, rule)).toBe(true);
  });

  it("prunes only counters older than a day", async () => {
    const old = `${prefix}:old`;
    const recent = `${prefix}:recent`;
    await limits.consumeRateLimit(old, rule);
    await limits.consumeRateLimit(recent, rule);
    await sql`update rate_limits set window_start = now() - interval '25 hours' where key = ${old}`;

    await limits.pruneRateLimits();
    const keys = (
      await sql`select key from rate_limits where key in (${old}, ${recent})`
    ).map((r) => r.key);
    expect(keys).toEqual([recent]);
  });
});
