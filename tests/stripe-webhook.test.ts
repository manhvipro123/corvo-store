import { beforeEach, describe, expect, it, vi } from "vitest";

/**
 * The webhook is the only thing that confirms payments: it must refuse
 * unsigned or misconfigured calls, skip handled events, and answer 5xx on
 * failures so Stripe retries.
 */

const constructEvent = vi.fn();
vi.mock("@/lib/stripe", () => ({ stripe: { webhooks: { constructEvent } } }));
const isEventProcessed = vi.fn(async () => false);
vi.mock("@/db/orders", () => ({ isEventProcessed }));
const syncCheckoutSession = vi.fn();
vi.mock("@/lib/checkout-session", () => ({ syncCheckoutSession }));

const { POST } = await import("@/app/api/stripe/webhook/route");

const BODY = '{"id":"evt_1"}';
const call = (signature: string | null = "t=1,v1=abc") =>
  POST(
    new Request("http://localhost/api/stripe/webhook", {
      method: "POST",
      body: BODY,
      headers: signature ? { "stripe-signature": signature } : {},
    }),
  );

const event = (type: string, payment_status = "paid") => ({
  id: "evt_1",
  type,
  data: { object: { id: "cs_1", payment_status } },
});

describe("Stripe webhook", () => {
  beforeEach(() => {
    vi.clearAllMocks();
    vi.spyOn(console, "error").mockImplementation(() => {});
    vi.stubEnv("STRIPE_WEBHOOK_SECRET", "whsec_test");
  });

  it("answers 500 when the secret isn't configured, so Stripe retries", async () => {
    vi.stubEnv("STRIPE_WEBHOOK_SECRET", "");
    expect((await call()).status).toBe(500);
    expect(constructEvent).not.toHaveBeenCalled();
  });

  it("refuses a request without a signature", async () => {
    expect((await call(null)).status).toBe(400);
    expect(constructEvent).not.toHaveBeenCalled();
  });

  it("refuses a bad signature, checked against the raw body", async () => {
    constructEvent.mockImplementation(() => {
      throw new Error("No signatures found");
    });
    expect((await call("t=1,v1=forged")).status).toBe(400);
    expect(constructEvent).toHaveBeenCalledWith(
      BODY,
      "t=1,v1=forged",
      "whsec_test",
    );
    expect(syncCheckoutSession).not.toHaveBeenCalled();
  });

  it("acknowledges events it doesn't handle without touching orders", async () => {
    constructEvent.mockReturnValue(event("payment_intent.succeeded"));
    expect((await call()).status).toBe(200);
    expect(isEventProcessed).not.toHaveBeenCalled();
    expect(syncCheckoutSession).not.toHaveBeenCalled();
  });

  it("skips an event it already handled", async () => {
    constructEvent.mockReturnValue(event("checkout.session.completed"));
    isEventProcessed.mockResolvedValueOnce(true);
    expect((await call()).status).toBe(200);
    expect(syncCheckoutSession).not.toHaveBeenCalled();
  });

  it("applies a completed payment to its order", async () => {
    constructEvent.mockReturnValue(event("checkout.session.completed"));
    expect((await call()).status).toBe(200);
    expect(syncCheckoutSession).toHaveBeenCalledWith(
      expect.objectContaining({ id: "cs_1" }),
      { to: "paid", from: ["pending"], release: false },
      { id: "evt_1", type: "checkout.session.completed" },
    );
  });

  it("applies an expiry as a release (which refreshes the storefront itself)", async () => {
    constructEvent.mockReturnValue(event("checkout.session.expired", "unpaid"));
    expect((await call()).status).toBe(200);
    expect(syncCheckoutSession).toHaveBeenCalledWith(
      expect.objectContaining({ id: "cs_1" }),
      expect.objectContaining({ to: "expired", release: true }),
      { id: "evt_1", type: "checkout.session.expired" },
    );
  });

  it("answers 500 when handling fails, so Stripe retries", async () => {
    constructEvent.mockReturnValue(event("checkout.session.completed"));
    syncCheckoutSession.mockRejectedValueOnce(new Error("DB down"));
    expect((await call()).status).toBe(500);
  });
});
