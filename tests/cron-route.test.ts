import { beforeEach, describe, expect, it, vi } from "vitest";

const releaseStalePendingOrders = vi.fn(async () => ({
  released: 2,
  needsReconcile: 1,
  skipped: 1,
}));
vi.mock("@/lib/checkout-session", () => ({ releaseStalePendingOrders }));

const { GET } = await import("@/app/api/cron/release-expired/route");

const call = (authorization?: string) =>
  GET(
    new Request("http://localhost/api/cron/release-expired", {
      headers: authorization ? { authorization } : {},
    }),
  );

describe("cron: release expired checkouts", () => {
  beforeEach(() => {
    vi.clearAllMocks();
    vi.stubEnv("CRON_SECRET", "s3cret-value");
  });

  it.each([
    [undefined],
    ["Bearer wrong"],
    ["s3cret-value"],
    ["Bearer s3cret-value-and-more"],
  ])("refuses authorization %s", async (header) => {
    const response = await call(header);
    expect(response.status).toBe(401);
    expect(releaseStalePendingOrders).not.toHaveBeenCalled();
  });

  it("refuses everything when no secret is configured", async () => {
    vi.stubEnv("CRON_SECRET", "");
    expect((await call("Bearer ")).status).toBe(401);
    expect(releaseStalePendingOrders).not.toHaveBeenCalled();
  });

  it("runs the sweep with the right secret", async () => {
    const response = await call("Bearer s3cret-value");
    expect(response.status).toBe(200);
    expect(await response.json()).toEqual({
      released: 2,
      needsReconcile: 1,
      skipped: 1,
    });
    expect(releaseStalePendingOrders).toHaveBeenCalledOnce();
  });
});
