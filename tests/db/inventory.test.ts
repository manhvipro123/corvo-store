import { neon } from "@neondatabase/serverless";
import { afterAll, beforeAll, describe, expect, it } from "vitest";

import { STOCK_MAX } from "@/lib/admin-validation";
import type { ReservedLine } from "@/lib/checkout";

const url = process.env.TEST_DATABASE_URL;

/**
 * Stock writes and their history. Every test creates its own products, so
 * nothing depends on seeded quantities or on other tests. After each
 * scenario the history must add up: sum(delta) == quantity.
 */
describe.skipIf(!url)("inventory writes and history (test database)", () => {
  // Loaded in a hook: src/db/index.ts throws without a database URL.
  let q: typeof import("@/db/queries");
  let admin: typeof import("@/db/catalog-admin");
  let orders: typeof import("@/db/orders");
  const sql = neon(url ?? "postgresql://skipped@localhost/none");
  const run = crypto.randomUUID().slice(0, 8);
  const userId = `inventory-test-${run}`;
  const productIds: number[] = [];
  let categoryId: number;

  beforeAll(async () => {
    q = await import("@/db/queries");
    admin = await import("@/db/catalog-admin");
    orders = await import("@/db/orders");
    categoryId = (await sql`select id from categories order by id limit 1`)[0]
      .id as number;
    await sql`insert into users (id, name, email, created_at, updated_at)
              values (${userId}, 'Inventory Admin', ${`${userId}@example.test`}, now(), now())`;
  });

  afterAll(async () => {
    if (!url) return;
    await sql`delete from orders where user_id = ${userId}`;
    if (productIds.length)
      await sql`delete from products where id = any(${productIds})`;
    await sql`delete from users where id = ${userId}`;
  });

  /** A fresh product with `stock` units, created like the admin form does. */
  async function product(stock: number) {
    const tag = `${run}-${crypto.randomUUID().slice(0, 6)}`;
    const id = await admin.createProduct(
      {
        name: `Inventory ${tag}`,
        slug: `inventory-${tag}`,
        sku: `INV-${tag}`.toUpperCase(),
        categoryId,
        color: "black",
        priceCents: 1000,
        description: "Inventory test.",
        details: [],
        imageUrl: "https://images.unsplash.com/photo-test",
        imageAlt: "Test",
        imageFit: "contain",
        isNew: false,
      },
      stock,
      userId,
    );
    productIds.push(id);
    return id;
  }

  const stockOf = async (id: number) =>
    (await sql`select quantity from product_stock where product_id = ${id}`)[0]
      ?.quantity as number;

  const history = (id: number) =>
    sql`select delta, quantity_after, reason, order_id, actor_user_id, note
        from stock_movements where product_id = ${id} order by id`;

  async function expectLedgerMatches(id: number) {
    const [row] = await sql`
      select s.quantity, coalesce(sum(m.delta), 0)::int as total
      from product_stock s
      left join stock_movements m on m.product_id = s.product_id
      where s.product_id = ${id}
      group by s.quantity`;
    expect(row.total).toBe(row.quantity);
  }

  const line = async (id: number, quantity: number): Promise<ReservedLine> => {
    const [p] =
      await sql`select name, sku, price_cents, image_url from products where id = ${id}`;
    return {
      productId: id,
      name: p.name,
      sku: p.sku,
      imageUrl: p.image_url,
      unitPriceCents: p.price_cents,
      quantity,
    };
  };

  it("records the starting stock of a new product", async () => {
    const id = await product(5);
    expect(await history(id)).toEqual([
      expect.objectContaining({
        delta: 5,
        quantity_after: 5,
        reason: "initial",
        actor_user_id: userId,
      }),
    ]);
    const empty = await product(0);
    expect(await history(empty)).toEqual([]);
    expect(await stockOf(empty)).toBe(0);
  });

  it("sets stock with an exact history row, and none when refused", async () => {
    const id = await product(5);
    await admin.setStock({ productId: id, expected: 5, quantity: 2 }, userId);
    expect(await stockOf(id)).toBe(2);

    await expect(
      admin.setStock({ productId: id, expected: 5, quantity: 9 }, userId),
    ).rejects.toMatchObject({ current: 2 });
    // Setting what is already there changes nothing and records nothing.
    await admin.setStock({ productId: id, expected: 2, quantity: 2 }, userId);

    const rows = await history(id);
    expect(rows).toHaveLength(2);
    expect(rows[1]).toMatchObject({
      delta: -3,
      quantity_after: 2,
      reason: "admin_set",
      actor_user_id: userId,
    });
    await expectLedgerMatches(id);
  });

  it("adjusts stock within its bounds", async () => {
    const id = await product(3);
    await admin.adjustStock({
      productId: id,
      delta: 4,
      note: "Delivery 1042",
      actorUserId: userId,
    });
    await admin.adjustStock({ productId: id, delta: -2, actorUserId: userId });
    expect(await stockOf(id)).toBe(5);

    await expect(
      admin.adjustStock({ productId: id, delta: -6, actorUserId: userId }),
    ).rejects.toMatchObject({ current: 5 });
    await expect(
      admin.adjustStock({ productId: id, delta: -6, actorUserId: userId }),
    ).rejects.toBeInstanceOf(admin.InsufficientStockError);
    await expect(
      admin.adjustStock({
        productId: id,
        delta: STOCK_MAX,
        actorUserId: userId,
      }),
    ).rejects.toBeInstanceOf(admin.StockLimitError);
    await expect(
      admin.adjustStock({ productId: 999_999, delta: 1, actorUserId: userId }),
    ).rejects.toBeInstanceOf(admin.NotFoundError);

    expect(await stockOf(id)).toBe(5);
    const rows = await history(id);
    expect(rows.map((r) => [r.reason, r.delta, r.note])).toEqual([
      ["initial", 3, null],
      ["admin_adjust", 4, "Delivery 1042"],
      ["admin_adjust", -2, null],
    ]);
    await expectLedgerMatches(id);
  });

  it("records reservations and releases each held unit once", async () => {
    const id = await product(4);
    const order = await orders.reserveOrder({
      userId,
      lines: [await line(id, 3)],
    });
    expect(await stockOf(id)).toBe(1);

    const expire = { to: "expired" as const, from: ["pending" as const] };
    await Promise.all([
      orders.releaseOrder(order.id, expire),
      orders.releaseOrder(order.id, expire),
    ]);
    expect(await stockOf(id)).toBe(4);

    const rows = await history(id);
    expect(rows.map((r) => [r.reason, r.delta, r.quantity_after])).toEqual([
      ["initial", 4, 4],
      ["reserve", -3, 1],
      ["release", 3, 4],
    ]);
    expect(rows[1].order_id).toBe(order.id);
    expect(rows[2].order_id).toBe(order.id);
    await expectLedgerMatches(id);
  });

  it("brings held units back after 'sold out' (agreed meaning: available = 0)", async () => {
    const id = await product(5);
    const order = await orders.reserveOrder({
      userId,
      lines: [await line(id, 3)],
    });
    await admin.setStock({ productId: id, expected: 2, quantity: 0 }, userId);
    expect(await stockOf(id)).toBe(0);

    await orders.releaseOrder(order.id, { to: "expired", from: ["pending"] });
    expect(await stockOf(id)).toBe(3);
    await expectLedgerMatches(id);
  });

  it("never loses an update when an admin save races a checkout", async () => {
    const id = await product(5);
    const [set, reserve] = await Promise.allSettled([
      admin.setStock({ productId: id, expected: 5, quantity: 10 }, userId),
      orders.reserveOrder({ userId, lines: [await line(id, 2)] }),
    ]);
    expect(reserve.status).toBe("fulfilled");
    const quantity = await stockOf(id);
    if (set.status === "fulfilled") {
      // The admin's write went first, then the checkout took 2.
      expect(quantity).toBe(8);
    } else {
      // The checkout went first; the stale admin save was refused.
      expect(set.reason).toBeInstanceOf(admin.StockChangedError);
      expect(quantity).toBe(3);
    }
    await expectLedgerMatches(id);
  });

  it("finds only pending checkouts past their reservation", async () => {
    const id = await product(6);
    const stale = await orders.reserveOrder({
      userId,
      lines: [await line(id, 1)],
    });
    const open = await orders.reserveOrder({
      userId,
      lines: [await line(id, 2)],
    });
    const processing = await orders.reserveOrder({
      userId,
      lines: [await line(id, 1)],
    });
    await sql`update orders set expires_at = now() - interval '1 hour' where id = ${stale.id}`;
    await sql`update orders set status = 'processing' where id = ${processing.id}`;

    const found = await orders.getStalePendingOrders(new Date(), 500);
    const ids = found.map((o) => o.id);
    expect(ids).toContain(stale.id);
    expect(ids).not.toContain(open.id);
    expect(ids).not.toContain(processing.id);

    expect(await q.getInventoryItem(id)).toMatchObject({
      available: 2,
      onHold: 2,
      staleHolds: 1,
      processing: 1,
    });
    await expectLedgerMatches(id);
  });

  it("searches and pages the inventory list", async () => {
    const id = await product(1);
    const [p] = await sql`select sku from products where id = ${id}`;
    const found = await q.getInventory({ query: p.sku, page: 1 });
    expect(found.rows.map((r) => r.id)).toEqual([id]);
    expect(found.hasNextPage).toBe(false);

    const first = await q.getInventory({ page: 1 });
    expect(first.rows.length).toBeLessThanOrEqual(q.INVENTORY_PAGE_SIZE);
    const beyond = await q.getInventory({ page: 10_000 });
    expect(beyond).toEqual({ rows: [], hasNextPage: false });
  });

  it("lists a product's history newest first, with the admin's name", async () => {
    const id = await product(2);
    await admin.adjustStock({
      productId: id,
      delta: 1,
      note: "Found one",
      actorUserId: userId,
    });
    const movements = await q.getStockMovements(id);
    expect(movements.map((m) => m.reason)).toEqual(["admin_adjust", "initial"]);
    expect(movements[0]).toMatchObject({
      delta: 1,
      quantityAfter: 3,
      note: "Found one",
      actorName: "Inventory Admin",
    });
  });
});
