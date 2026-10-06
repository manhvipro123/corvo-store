import { beforeEach, describe, expect, it, vi } from "vitest";

/**
 * The stale-checkout sweep releases stock only when that is safe: no Stripe
 * session at all, or Stripe confirms the session expired. A completed
 * session is left for the webhook (only it marks orders paid).
 */

const getStalePendingOrders = vi.fn();
const releaseOrder = vi.fn(async () => ({ rows: [{ product_id: 1 }] }));
const markReconcileNeeded = vi.fn();
const getPendingOrdersForUser = vi.fn();
const getOrderLines = vi.fn();
const getOrderRecord = vi.fn();
vi.mock("@/db/orders", () => ({
  getPendingOrdersForUser,
  getStalePendingOrders,
  markReconcileNeeded,
  releaseOrder,
  applyTransition: vi.fn(),
  attachCheckoutSession: vi.fn(),
  getOrderLines,
  getOrderRecord,
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
const removeOrderedFromBag = vi.fn(async () => true);
vi.mock("@/lib/bag-cookie", () => ({ removeOrderedFromBag }));
const deleteCookie = vi.fn();
const getCookie = vi.fn();
const setCookie = vi.fn();
vi.mock("next/headers", () => ({
  cookies: vi.fn(async () => ({
    delete: deleteCookie,
    get: getCookie,
    set: setCookie,
  })),
}));

const {
  cancelPendingCheckout,
  clearConfirmedCheckout,
  releaseStalePendingOrders,
} = await import("@/lib/checkout-session");
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
      needsReconcile: 0,
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
      needsReconcile: 0,
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
      needsReconcile: 1,
      skipped: 0,
    });
    expect(expire).toHaveBeenCalledWith("cs_expired");
    expect(releaseOrder).toHaveBeenCalledTimes(1);
    expect(releaseOrder).toHaveBeenCalledWith("o1", EXPIRE);
  });

  it("flags a session completed without its webhook instead of releasing it", async () => {
    getStalePendingOrders.mockResolvedValue([
      { id: "o1", stripeCheckoutSessionId: "cs_complete" },
    ]);
    retrieve.mockResolvedValue({ status: "complete" });

    expect(await releaseStalePendingOrders()).toEqual({
      released: 0,
      needsReconcile: 1,
      skipped: 0,
    });
    expect(markReconcileNeeded).toHaveBeenCalledWith("o1");
    expect(releaseOrder).not.toHaveBeenCalled();
    expect(revalidateStorefront).not.toHaveBeenCalled();
  });

  it("leaves a still-open session for the next run without flagging it", async () => {
    getStalePendingOrders.mockResolvedValue([
      { id: "o1", stripeCheckoutSessionId: "cs_open" },
    ]);
    retrieve.mockResolvedValue({ status: "open" });

    expect(await releaseStalePendingOrders()).toEqual({
      released: 0,
      needsReconcile: 0,
      skipped: 1,
    });
    expect(markReconcileNeeded).not.toHaveBeenCalled();
    expect(releaseOrder).not.toHaveBeenCalled();
  });

  it("counts an order already released elsewhere as skipped", async () => {
    getStalePendingOrders.mockResolvedValue([
      { id: "o1", stripeCheckoutSessionId: null },
    ]);
    releaseOrder.mockResolvedValueOnce({ rows: [] });
    expect(await releaseStalePendingOrders()).toEqual({
      released: 0,
      needsReconcile: 0,
      skipped: 1,
    });
    expect(revalidateStorefront).not.toHaveBeenCalled();
  });

  it("releases an order whose session Stripe doesn't know", async () => {
    getStalePendingOrders.mockResolvedValue([
      { id: "o1", stripeCheckoutSessionId: "cs_test_other_mode" },
    ]);
    retrieve.mockRejectedValue(
      Object.assign(new Error("No such checkout.session"), {
        code: "resource_missing",
      }),
    );
    expect(await releaseStalePendingOrders()).toEqual({
      released: 1,
      needsReconcile: 0,
      skipped: 0,
    });
    expect(releaseOrder).toHaveBeenCalledWith("o1", EXPIRE);
  });

  it("keeps going when one order fails", async () => {
    getStalePendingOrders.mockResolvedValue([
      { id: "o1", stripeCheckoutSessionId: "cs_down" },
      { id: "o2", stripeCheckoutSessionId: null },
    ]);
    retrieve.mockRejectedValue(new Error("Stripe unreachable"));
    expect(await releaseStalePendingOrders()).toEqual({
      released: 1,
      needsReconcile: 0,
      skipped: 1,
    });
  });
});

describe("cancelPendingCheckout", () => {
  beforeEach(() => vi.clearAllMocks());

  it("ends every pending checkout of the user, not just this browser's", async () => {
    getPendingOrdersForUser.mockResolvedValue([
      { id: "o1", stripeCheckoutSessionId: "cs_1" },
      { id: "o2", stripeCheckoutSessionId: "cs_2" },
    ]);
    retrieve.mockResolvedValue({ status: "expired" });

    expect(await cancelPendingCheckout("user-1")).toBe(false);

    expect(getPendingOrdersForUser).toHaveBeenCalledWith("user-1");
    expect(deleteCookie).toHaveBeenCalledWith("corvo_checkout");
    expect(expire).toHaveBeenCalledWith("cs_1");
    expect(expire).toHaveBeenCalledWith("cs_2");
    expect(releaseOrder).toHaveBeenCalledWith("o1", EXPIRE);
    expect(releaseOrder).toHaveBeenCalledWith("o2", EXPIRE);
  });

  it("leaves a checkout Stripe reports complete for the webhook, and says so", async () => {
    getPendingOrdersForUser.mockResolvedValue([
      { id: "o1", stripeCheckoutSessionId: "cs_paid" },
    ]);
    retrieve.mockResolvedValue({ status: "complete" });

    expect(await cancelPendingCheckout("user-1")).toBe(true);

    expect(releaseOrder).not.toHaveBeenCalled();
    // Remembered, so its pieces leave the bag once the webhook confirms it.
    expect(setCookie).toHaveBeenCalledWith(
      "corvo_checkout",
      "o1",
      expect.objectContaining({ httpOnly: true }),
    );
  });
});

describe("clearConfirmedCheckout", () => {
  const lines = [{ productId: 1, quantity: 2 }];
  beforeEach(() => {
    vi.clearAllMocks();
    getCookie.mockReturnValue({ value: "o1" });
    getOrderLines.mockResolvedValue(lines);
  });

  it.each(["paid", "processing"])(
    "takes a %s order's pieces out of the bag",
    async (status) => {
      getOrderRecord.mockResolvedValue({ id: "o1", userId: "u1", status });
      expect(await clearConfirmedCheckout("u1")).toBe(true);
      expect(removeOrderedFromBag).toHaveBeenCalledWith(lines);
      expect(deleteCookie).toHaveBeenCalledWith("corvo_checkout");
    },
  );

  it.each([
    ["another user's order", { id: "o1", userId: "u2", status: "paid" }],
    ["an unpaid order", { id: "o1", userId: "u1", status: "pending" }],
    ["a missing order", undefined],
  ])("leaves the bag alone for %s", async (_, order) => {
    getOrderRecord.mockResolvedValue(order);
    expect(await clearConfirmedCheckout("u1")).toBe(false);
    expect(removeOrderedFromBag).not.toHaveBeenCalled();
  });
});
