import { neon } from "@neondatabase/serverless";
import { afterAll, beforeAll, describe, expect, it } from "vitest";

import type { ReservedLine, Transition } from "@/lib/checkout";

import { deleteTestStock, setTestStock } from "./stock";
import { testUsers } from "./users";

const url = process.env.TEST_DATABASE_URL;

describe.skipIf(!url)("orders and stock reservation (test database)", () => {
  // Loaded in a hook: src/db/index.ts throws without a database URL.
  let orders: typeof import("@/db/orders");
  const sql = neon(url ?? "postgresql://skipped@localhost/none");
  const users = testUsers(
    sql,
    `orders-test-${crypto.randomUUID().slice(0, 8)}`,
  );
  // Never left holding a pending order, so any test can start one for it.
  let userId: string;
  const paid = {
    totalCents: null,
    email: null,
    shipping: null,
    paymentIntentId: null,
  };

  beforeAll(async () => {
    orders = await import("@/db/orders");
    userId = await users.shopper("Orders Test");
  });

  afterAll(async () => {
    if (!url) return;
    await users.cleanup();
  });

  async function product(slug: string, stock: number | null) {
    const [row] =
      await sql`select id, name, sku, price_cents, image_url from products where slug = ${slug}`;
    if (stock === null) await deleteTestStock(sql, row.id);
    else await setTestStock(sql, row.id, stock);
    return {
      productId: row.id as number,
      name: row.name as string,
      sku: row.sku as string,
      imageUrl: row.image_url as string,
      unitPriceCents: row.price_cents as number,
    };
  }

  const stockOf = async (productId: number) =>
    (
      await sql`select quantity from product_stock where product_id = ${productId}`
    )[0]?.quantity as number | undefined;
  const statusOf = async (orderId: string) =>
    (await sql`select status from orders where id = ${orderId}`)[0]?.status;

  it("creates a pending order with price snapshots and reserves stock", async () => {
    const bag = await product("top-handle-bag-cognac", 5);
    const lines: ReservedLine[] = [{ ...bag, quantity: 2 }];
    const before = Date.now();
    const order = await orders.reserveOrder({
      userId: await users.shopper(),
      lines,
    });

    // Still at least Stripe's 30-minute minimum when the session is created.
    expect(order.expiresAt.getTime()).toBeGreaterThanOrEqual(
      before + 30 * 60_000 + 30_000,
    );

    expect(order.subtotalCents).toBe(bag.unitPriceCents * 2);
    expect(await stockOf(bag.productId)).toBe(3);
    expect(await statusOf(order.id)).toBe("pending");
    const [item] =
      await sql`select unit_price_cents, quantity from order_items where order_id = ${order.id}`;
    expect(item).toEqual({ unit_price_cents: bag.unitPriceCents, quantity: 2 });
    expect(await orders.getOrderLines(order.id)).toEqual([
      { productId: bag.productId, quantity: 2 },
    ]);
  });

  it("lets only one of two simultaneous checkouts take the last piece", async () => {
    const boot = await product("brogue-boot-chestnut", 1);
    const line = { ...boot, quantity: 1 };
    const [first, second] = [await users.shopper(), await users.shopper()];
    const results = await Promise.allSettled([
      orders.reserveOrder({ userId: first, lines: [line] }),
      orders.reserveOrder({ userId: second, lines: [line] }),
    ]);

    expect(results.filter((r) => r.status === "fulfilled")).toHaveLength(1);
    const rejected = results.find((r) => r.status === "rejected");
    expect(rejected?.reason).toBeInstanceOf(orders.OutOfStockError);
    expect(await stockOf(boot.productId)).toBe(0);
  });

  it("lets a user hold only one pending order, even when two start at once", async () => {
    const pump = await product("slingback-pump-noir", 4);
    const line = { ...pump, quantity: 1 };
    const shopper = await users.shopper();
    const results = await Promise.allSettled([
      orders.reserveOrder({ userId: shopper, lines: [line] }),
      orders.reserveOrder({ userId: shopper, lines: [line] }),
    ]);

    const [held] = results.flatMap((r) =>
      r.status === "fulfilled" ? [r.value] : [],
    );
    const rejected = results.filter((r) => r.status === "rejected");
    expect(rejected).toHaveLength(1);
    expect(rejected[0].reason).toBeInstanceOf(orders.CheckoutInProgressError);
    // The refused one reserved nothing.
    expect(await stockOf(pump.productId)).toBe(3);

    // Once the first one ends, the next checkout can start.
    await orders.releaseOrder(held.id, { to: "expired", from: ["pending"] });
    const next = await orders.reserveOrder({ userId: shopper, lines: [line] });
    expect(await statusOf(next.id)).toBe("pending");
  });

  it("reserves all lines or none", async () => {
    const pump = await product("slingback-pump-noir", 4);
    const shirt = await product("poplin-shirt-white", 1);
    await expect(
      orders.reserveOrder({
        userId,
        lines: [
          { ...pump, quantity: 1 },
          { ...shirt, quantity: 2 },
        ],
      }),
    ).rejects.toBeInstanceOf(orders.OutOfStockError);
    expect(await stockOf(pump.productId)).toBe(4);
    expect(await stockOf(shirt.productId)).toBe(1);
  });

  it("treats a product without a stock row as sold out and undoes the rest", async () => {
    const pump = await product("slingback-pump-noir", 4);
    const coat = await product("wool-jacket-noir", null);
    await expect(
      orders.reserveOrder({
        userId,
        lines: [
          { ...pump, quantity: 1 },
          { ...coat, quantity: 1 },
        ],
      }),
    ).rejects.toBeInstanceOf(orders.OutOfStockError);
    expect(await stockOf(pump.productId)).toBe(4);
  });

  it("releases stock once, however often the release runs", async () => {
    const pump = await product("slingback-pump-noir", 4);
    const order = await orders.reserveOrder({
      userId,
      lines: [{ ...pump, quantity: 3 }],
    });
    expect(await stockOf(pump.productId)).toBe(1);

    const expire = { to: "expired", from: ["pending"] } as const;
    await Promise.all([
      orders.releaseOrder(order.id, { ...expire, from: [...expire.from] }),
      orders.releaseOrder(order.id, { ...expire, from: [...expire.from] }),
    ]);
    await orders.releaseOrder(order.id, { ...expire, from: ["pending"] });

    expect(await stockOf(pump.productId)).toBe(4);
    expect(await statusOf(order.id)).toBe("expired");
  });

  it("never moves a paid order back, and skips a replayed event", async () => {
    const pump = await product("slingback-pump-noir", 4);
    const order = await orders.reserveOrder({
      userId,
      lines: [{ ...pump, quantity: 1 }],
    });
    const event = {
      id: `evt_test_${order.id}`,
      type: "checkout.session.completed",
    };

    expect(await orders.isEventProcessed(event.id)).toBe(false);
    await orders.applyTransition(
      order.id,
      { to: "paid", from: ["pending"], release: false },
      { ...paid, totalCents: pump.unitPriceCents },
      event,
    );
    expect(await orders.isEventProcessed(event.id)).toBe(true);
    // A replay of the same event is harmless even if it slips through.
    await orders.applyTransition(
      order.id,
      { to: "paid", from: ["pending"], release: false },
      paid,
      event,
    );
    // A late expiry must not release stock for a paid order.
    await orders.applyTransition(
      order.id,
      { to: "expired", from: ["pending"], release: true },
      paid,
    );

    expect(await statusOf(order.id)).toBe("paid");
    expect(await stockOf(pump.productId)).toBe(3);
    const [row] =
      await sql`select total_cents, paid_at from orders where id = ${order.id}`;
    expect(row.total_cents).toBe(pump.unitPriceCents);
    expect(row.paid_at).not.toBeNull();
    const events =
      await sql`select count(*)::int as n from stripe_events where id = ${event.id}`;
    expect(events[0].n).toBe(1);
  });

  it("settles an async payment whose result arrives before `completed`", async () => {
    const pump = await product("slingback-pump-noir", 4);
    const [succeeded, failed] = await Promise.all(
      [1, 2].map(async () =>
        orders.reserveOrder({
          userId: await users.shopper(),
          lines: [{ ...pump, quantity: 1 }],
        }),
      ),
    );
    expect(await stockOf(pump.productId)).toBe(2);
    const late = {
      to: "processing",
      from: ["pending"],
      release: false,
    } satisfies Transition;

    await orders.applyTransition(
      succeeded.id,
      { to: "paid", from: ["pending", "processing"], release: false },
      paid,
      {
        id: `evt_ok_${succeeded.id}`,
        type: "checkout.session.async_payment_succeeded",
      },
    );
    await orders.applyTransition(
      failed.id,
      { to: "failed", from: ["pending", "processing"], release: true },
      paid,
      {
        id: `evt_fail_${failed.id}`,
        type: "checkout.session.async_payment_failed",
      },
    );
    // The late `completed` (unpaid) must not reopen either order.
    for (const id of [succeeded.id, failed.id])
      await orders.applyTransition(id, late, paid, {
        id: `evt_done_${id}`,
        type: "checkout.session.completed",
      });

    expect(await statusOf(succeeded.id)).toBe("paid");
    expect(await statusOf(failed.id)).toBe("failed");
    expect(await stockOf(pump.productId)).toBe(3);
  });

  it("lists only the user's own pending orders with a session, marking reconcile-flagged ones", async () => {
    const pump = await product("slingback-pump-noir", 4);
    const line = { ...pump, quantity: 1 };
    const pendingWithSession = async (shopper: string) => {
      const order = await orders.reserveOrder({
        userId: shopper,
        lines: [line],
      });
      expect(
        await orders.attachCheckoutSession(order.id, `cs_test_${order.id}`),
      ).toBe(true);
      return order;
    };

    const open = await users.shopper();
    const mine = await pendingWithSession(open);
    // Another user's checkout is never listed.
    await pendingWithSession(await users.shopper());
    // Still being created by another request: never cancelled from here.
    const creating = await users.shopper();
    await orders.reserveOrder({ userId: creating, lines: [line] });
    const paidAtStripe = await users.shopper();
    const flagged = await pendingWithSession(paidAtStripe);
    await orders.markReconcileNeeded(flagged.id);

    expect(await orders.getPendingOrdersForUser(open)).toEqual([
      {
        id: mine.id,
        stripeCheckoutSessionId: `cs_test_${mine.id}`,
        reconcileNeeded: false,
      },
    ]);
    expect(await orders.getPendingOrdersForUser(creating)).toEqual([]);
    // Unless its request died: then the next checkout ends it.
    await sql`update orders set created_at = now() - interval '3 minutes' where user_id = ${creating}`;
    expect(await orders.getPendingOrdersForUser(creating)).toEqual([
      expect.objectContaining({ stripeCheckoutSessionId: null }),
    ]);
    expect(await orders.getPendingOrdersForUser(paidAtStripe)).toEqual([
      {
        id: flagged.id,
        stripeCheckoutSessionId: `cs_test_${flagged.id}`,
        reconcileNeeded: true,
      },
    ]);
  });

  it("won't attach a session to an order that ended meanwhile", async () => {
    const pump = await product("slingback-pump-noir", 4);
    const order = await orders.reserveOrder({
      userId,
      lines: [{ ...pump, quantity: 1 }],
    });
    await orders.releaseOrder(order.id, { to: "expired", from: ["pending"] });

    expect(
      await orders.attachCheckoutSession(order.id, `cs_test_${order.id}`),
    ).toBe(false);
    const [row] =
      await sql`select stripe_checkout_session_id from orders where id = ${order.id}`;
    expect(row.stripe_checkout_session_id).toBeNull();
  });

  it("lists only the user's own placed orders, newest first", async () => {
    const queries = await import("@/db/queries");
    const pump = await product("slingback-pump-noir", 10);
    const other = await users.shopper("Other");
    const reserve = (uid: string, quantity: number) =>
      orders.reserveOrder({ userId: uid, lines: [{ ...pump, quantity }] });
    // One at a time: each ends before the user's next checkout starts.
    const older = await reserve(userId, 2);
    await sql`update orders set created_at = now() - interval '1 day' where id = ${older.id}`;
    await sql`update orders set status = 'paid', total_cents = 123 where id = ${older.id}`;
    const newer = await reserve(userId, 1);
    await sql`update orders set status = 'failed' where id = ${newer.id}`;
    const abandoned = await reserve(userId, 1);
    await orders.releaseOrder(abandoned.id, {
      to: "expired",
      from: ["pending"],
    });
    const theirs = await reserve(other, 1);
    await sql`update orders set status = 'paid' where id = ${theirs.id}`;

    const list = await queries.getOrdersForUser(userId);
    const ids = list.map((o) => o.id);
    expect(ids).not.toContain(theirs.id);
    expect(ids).not.toContain(abandoned.id);
    expect(ids.indexOf(newer.id)).toBeLessThan(ids.indexOf(older.id));
    expect(list.find((o) => o.id === older.id)).toMatchObject({
      status: "paid",
      itemCount: 2,
      totalCents: 123,
    });
    expect(list.find((o) => o.id === newer.id)).toMatchObject({
      status: "failed",
      totalCents: pump.unitPriceCents,
    });

    expect(
      await queries.getOrderForUser({ orderId: theirs.id }, userId),
    ).toBeUndefined();
  });

  it("shows the order as charged, only to its owner, after a price change", async () => {
    const queries = await import("@/db/queries");
    const pump = await product("slingback-pump-noir", 10);
    const owner = await users.shopper();
    const order = await orders.reserveOrder({
      userId: owner,
      lines: [{ ...pump, quantity: 2 }],
    });
    await sql`update products set price_cents = price_cents + 50000 where id = ${pump.productId}`;
    try {
      const detail = await queries.getOrderForUser(
        { orderId: order.id },
        owner,
      );
      expect(detail?.lines).toEqual([
        expect.objectContaining({
          productId: pump.productId,
          sku: pump.sku,
          unitPriceCents: pump.unitPriceCents,
          quantity: 2,
        }),
      ]);
      expect(detail?.subtotalCents).toBe(pump.unitPriceCents * 2);
      expect(
        await queries.getOrderForUser({ orderId: order.id }, "someone-else"),
      ).toBeUndefined();
    } finally {
      await sql`update products set price_cents = price_cents - 50000 where id = ${pump.productId}`;
    }
  });
});
