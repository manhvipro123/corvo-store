import { beforeEach, describe, expect, it, vi } from "vitest";

/**
 * The stale-checkout sweep releases stock only when that is safe: no Stripe
 * session at all, or Stripe confirms the session expired. A completed
 * session is left for the webhook (only it marks orders paid).
 */

const getStalePendingOrders = vi.fn();
const releaseOrder = vi.fn(async () => ({ rows: [{ product_id: 1 }] }));
vi.mock("@/db/orders", () => ({
  getStalePendingOrders,
  releaseOrder,
  applyTransition: vi.fn(),
  attachCheckoutSession: vi.fn(),
  getOrderRecord: vi.fn(),
  reserveOrder: vi.fn(),
}));
const expire = vi.fn();
const retrieve = vi.fn();
vi.mock("@/lib/stripe", () => ({
  stripe: { checkout: { sessions: { expire, retrieve } } },
  siteURL: () => "http://localhost:3000",
}));
const revalidateStorefront = vi.fn();
vi.mock("@/lib/storefront-cache", () => ({ revalidateStorefront }));
vi.mock("@/lib/bag-cookie", () => ({ clearBag: vi.fn() }));
vi.mock("next/headers", () => ({ cookies: vi.fn() }));

const { releaseStalePendingOrders } = await import("@/lib/checkout-session");
const EXPIRE = { to: "expired", from: ["pending"] };

describe("releaseStalePendingOrders", () => {
  beforeEach(() => {
    vi.clearAllMocks();
    vi.spyOn(console, "error").mockImplementation(() => {});
  });

  it("looks only at orders past their reservation plus a grace period", async () => {
    getStalePendingOrders.mockResolvedValue([]);
    const before = Date.now();
    expect(await releaseStalePendingOrders()).toEqual({
      released: 0,
      skipped: 0,
    });
    const [cutoff, limit] = getStalePendingOrders.mock.calls[0];
    expect(before - (cutoff as Date).getTime()).toBeGreaterThanOrEqual(
      5 * 60_000 - 1000,
    );
    expect(limit).toBe(50);
  });

  it("releases an order that never got a Stripe session", async () => {
    getStalePendingOrders.mockResolvedValue([
      { id: "o1", stripeCheckoutSessionId: null },
    ]);
    expect(await releaseStalePendingOrders()).toEqual({
      released: 1,
      skipped: 0,
    });
    expect(releaseOrder).toHaveBeenCalledWith("o1", EXPIRE);
    expect(retrieve).not.toHaveBeenCalled();
    expect(revalidateStorefront).toHaveBeenCalledOnce();
  });

  it("releases only after Stripe confirms the session expired", async () => {
    getStalePendingOrders.mockResolvedValue([
      { id: "o1", stripeCheckoutSessionId: "cs_expired" },
      { id: "o2", stripeCheckoutSessionId: "cs_complete" },
    ]);
    retrieve.mockImplementation(async (id: string) => ({
      status: id === "cs_expired" ? "expired" : "complete",
    }));

    expect(await releaseStalePendingOrders()).toEqual({
      released: 1,
      skipped: 1,
    });
    expect(expire).toHaveBeenCalledWith("cs_expired");
    expect(releaseOrder).toHaveBeenCalledTimes(1);
    expect(releaseOrder).toHaveBeenCalledWith("o1", EXPIRE);
  });

  it("counts an order already released elsewhere as skipped", async () => {
    getStalePendingOrders.mockResolvedValue([
      { id: "o1", stripeCheckoutSessionId: null },
    ]);
    releaseOrder.mockResolvedValueOnce({ rows: [] });
    expect(await releaseStalePendingOrders()).toEqual({
      released: 0,
      skipped: 1,
    });
    expect(revalidateStorefront).not.toHaveBeenCalled();
  });

  it("keeps going when one order fails", async () => {
    getStalePendingOrders.mockResolvedValue([
      { id: "o1", stripeCheckoutSessionId: "cs_down" },
      { id: "o2", stripeCheckoutSessionId: null },
    ]);
    retrieve.mockRejectedValue(new Error("Stripe unreachable"));
    expect(await releaseStalePendingOrders()).toEqual({
      released: 1,
      skipped: 1,
    });
  });
});
