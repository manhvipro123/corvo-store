import { neon } from "@neondatabase/serverless";
import { afterAll, beforeAll, describe, expect, it } from "vitest";

import type { ReservedLine, Transition } from "@/lib/checkout";

import { deleteTestStock, setTestStock } from "./stock";

const url = process.env.TEST_DATABASE_URL;

describe.skipIf(!url)("orders and stock reservation (test database)", () => {
  // Loaded in a hook: src/db/index.ts throws without a database URL.
  let orders: typeof import("@/db/orders");
  const sql = neon(url ?? "postgresql://skipped@localhost/none");
  const userId = `orders-test-${crypto.randomUUID().slice(0, 8)}`;
  const paid = {
    totalCents: null,
    email: null,
    shipping: null,
    paymentIntentId: null,
  };

  beforeAll(async () => {
    orders = await import("@/db/orders");
    await sql`insert into users (id, name, email, created_at, updated_at)
              values (${userId}, 'Orders Test', ${`${userId}@example.test`}, now(), now())`;
  });

  afterAll(async () => {
    if (!url) return;
    await sql`delete from orders where user_id = ${userId}`;
    await sql`delete from users where id = ${userId}`;
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
    const order = await orders.reserveOrder({ userId, lines });

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
    const results = await Promise.allSettled([
      orders.reserveOrder({ userId, lines: [line] }),
      orders.reserveOrder({ userId, lines: [line] }),
    ]);

    expect(results.filter((r) => r.status === "fulfilled")).toHaveLength(1);
    const rejected = results.find((r) => r.status === "rejected");
    expect(rejected?.reason).toBeInstanceOf(orders.OutOfStockError);
    expect(await stockOf(boot.productId)).toBe(0);
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
      [1, 2].map(() =>
        orders.reserveOrder({ userId, lines: [{ ...pump, quantity: 1 }] }),
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
    const other = `orders-test-${crypto.randomUUID().slice(0, 8)}`;
    await sql`insert into users (id, name, email, created_at, updated_at)
              values (${other}, 'Other', ${`${other}@example.test`}, now(), now())`;
    try {
      const pump = await product("slingback-pump-noir", 4);
      const line = { ...pump, quantity: 1 };
      const mine = await orders.reserveOrder({ userId: other, lines: [line] });
      expect(
        await orders.attachCheckoutSession(mine.id, `cs_test_${mine.id}`),
      ).toBe(true);
      // Still being created by another request: never cancelled from here.
      await orders.reserveOrder({ userId: other, lines: [line] });
      const flagged = await orders.reserveOrder({
        userId: other,
        lines: [line],
      });
      await orders.attachCheckoutSession(flagged.id, `cs_test_${flagged.id}`);
      await orders.markReconcileNeeded(flagged.id);
      await orders.reserveOrder({ userId, lines: [line] });

      const pending = await orders.getPendingOrdersForUser(other);
      expect(pending).toHaveLength(2);
      expect(pending).toEqual(
        expect.arrayContaining([
          {
            id: mine.id,
            stripeCheckoutSessionId: `cs_test_${mine.id}`,
            reconcileNeeded: false,
          },
          {
            id: flagged.id,
            stripeCheckoutSessionId: `cs_test_${flagged.id}`,
            reconcileNeeded: true,
          },
        ]),
      );
    } finally {
      await sql`delete from orders where user_id = ${other}`;
      await sql`delete from users where id = ${other}`;
    }
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
    const other = `${userId}-other`;
    await sql`insert into users (id, name, email, created_at, updated_at)
              values (${other}, 'Other', ${`${other}@example.test`}, now(), now())`;
    try {
      const reserve = (uid: string, quantity: number) =>
        orders.reserveOrder({ userId: uid, lines: [{ ...pump, quantity }] });
      const older = await reserve(userId, 2);
      const newer = await reserve(userId, 1);
      const abandoned = await reserve(userId, 1);
      const theirs = await reserve(other, 1);
      await sql`update orders set created_at = now() - interval '1 day' where id = ${older.id}`;
      await sql`update orders set status = 'paid', total_cents = 123 where id = ${older.id}`;
      await sql`update orders set status = 'failed' where id = ${newer.id}`;
      await sql`update orders set status = 'paid' where id = ${theirs.id}`;
      await orders.releaseOrder(abandoned.id, {
        to: "expired",
        from: ["pending"],
      });

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
    } finally {
      await sql`delete from orders where user_id = ${other}`;
      await sql`delete from users where id = ${other}`;
    }
  });

  it("shows the order as charged, only to its owner, after a price change", async () => {
    const queries = await import("@/db/queries");
    const pump = await product("slingback-pump-noir", 10);
    const order = await orders.reserveOrder({
      userId,
      lines: [{ ...pump, quantity: 2 }],
    });
    await sql`update products set price_cents = price_cents + 50000 where id = ${pump.productId}`;
    try {
      const detail = await queries.getOrderForUser(
        { orderId: order.id },
        userId,
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
