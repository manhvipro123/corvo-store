import { neon } from "@neondatabase/serverless";
import { afterAll, beforeAll, describe, expect, it } from "vitest";

import type { ReservedLine } from "@/lib/checkout";

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
    if (stock === null)
      await sql`delete from product_stock where product_id = ${row.id}`;
    else
      await sql`insert into product_stock (product_id, quantity) values (${row.id}, ${stock})
                on conflict (product_id) do update set quantity = ${stock}`;
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
    const order = await orders.reserveOrder({ userId, lines });

    expect(order.subtotalCents).toBe(bag.unitPriceCents * 2);
    expect(await stockOf(bag.productId)).toBe(3);
    expect(await statusOf(order.id)).toBe("pending");
    const [item] =
      await sql`select unit_price_cents, quantity from order_items where order_id = ${order.id}`;
    expect(item).toEqual({ unit_price_cents: bag.unitPriceCents, quantity: 2 });
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
});
