import { neon } from "@neondatabase/serverless";
import { afterAll, beforeAll, describe, expect, it } from "vitest";

import type { ProductInput } from "@/lib/admin-validation";

const url = process.env.TEST_DATABASE_URL;

describe.skipIf(!url)("admin catalog reads and writes (test database)", () => {
  // Loaded in a hook: src/db/index.ts throws without a database URL.
  let q: typeof import("@/db/queries");
  let admin: typeof import("@/db/catalog-admin");
  const sql = neon(url ?? "postgresql://skipped@localhost/none");
  const tag = crypto.randomUUID().slice(0, 8);
  const userId = `admin-test-${tag}`;
  let bagsId: number;

  const input = (overrides: Partial<ProductInput> = {}): ProductInput => ({
    name: `Test Tote ${tag}`,
    slug: `test-tote-${tag}`,
    sku: `TEST-${tag}`.toUpperCase(),
    categoryId: bagsId,
    color: "black",
    priceCents: 125050,
    description: "A test tote.",
    details: ["Calfskin", "Made in Italy"],
    imageUrl: "https://images.unsplash.com/photo-test?w=2000",
    imageAlt: "Black tote",
    imageFit: "contain",
    isNew: false,
    ...overrides,
  });

  const stockOf = async (productId: number) =>
    (
      await sql`select quantity from product_stock where product_id = ${productId}`
    )[0]?.quantity as number | undefined;

  beforeAll(async () => {
    q = await import("@/db/queries");
    admin = await import("@/db/catalog-admin");
    bagsId = (await sql`select id from categories where slug = 'bags'`)[0]
      .id as number;
    await sql`insert into users (id, name, email, created_at, updated_at)
              values (${userId}, 'Admin Test', ${`${userId}@example.test`}, now(), now())`;
  });

  afterAll(async () => {
    if (!url) return;
    await sql`delete from orders where user_id = ${userId}`;
    await sql`delete from users where id = ${userId}`;
    await sql`delete from products where slug like ${`%${tag}%`}`;
    await sql`delete from categories where slug like ${`%${tag}%`}`;
  });

  it("creates a product with its stock row, last in Recommended order", async () => {
    const id = await admin.createProduct(input(), 4);
    expect(await stockOf(id)).toBe(4);

    const product = await q.getAdminProduct(id);
    expect(product).toMatchObject({
      slug: `test-tote-${tag}`,
      category: "bags",
      priceCents: 125050,
      details: ["Calfskin", "Made in Italy"],
      stock: 4,
    });
    const all = await q.getAdminProducts({});
    expect(all.at(-1)?.id).toBe(id);
    expect(product!.position).toBeGreaterThan(all.at(-2)!.position);
  });

  it("reports duplicate slugs and SKUs by field, writing nothing", async () => {
    await expect(
      admin.createProduct(input({ sku: `OTHER-${tag}`.toUpperCase() }), 1),
    ).rejects.toMatchObject({ field: "slug" });
    await expect(
      admin.createProduct(input({ slug: `other-tote-${tag}` }), 1),
    ).rejects.toMatchObject({ field: "sku" });
    expect(
      await sql`select id from products where slug = ${`other-tote-${tag}`}`,
    ).toHaveLength(0);
  });

  it("rejects an unknown category", async () => {
    await expect(
      admin.createProduct(
        input({
          slug: `ghost-${tag}`,
          sku: `GHOST-${tag}`.toUpperCase(),
          categoryId: 999_999,
        }),
        1,
      ),
    ).rejects.toBeInstanceOf(admin.UnknownCategoryError);
  });

  it("updates a product without touching its stock or position", async () => {
    const [product] = await q.getAdminProducts({ query: tag });
    await admin.updateProduct(
      product.id,
      input({ name: `Renamed ${tag}`, priceCents: 99900 }),
    );
    expect(await q.getAdminProduct(product.id)).toMatchObject({
      name: `Renamed ${tag}`,
      priceCents: 99900,
      stock: 4,
      position: product.position,
    });
    await expect(admin.updateProduct(999_999, input())).rejects.toBeInstanceOf(
      admin.NotFoundError,
    );
  });

  it("sets stock only when it still matches what the admin saw", async () => {
    const [product] = await q.getAdminProducts({ query: tag });
    await admin.setStock({ productId: product.id, expected: 4, quantity: 7 });
    expect(await stockOf(product.id)).toBe(7);

    const stale = admin.setStock({
      productId: product.id,
      expected: 4,
      quantity: 1,
    });
    await expect(stale).rejects.toBeInstanceOf(admin.StockChangedError);
    await expect(stale).rejects.toMatchObject({ current: 7 });
    expect(await stockOf(product.id)).toBe(7);
  });

  it("creates a missing stock row", async () => {
    const [product] = await q.getAdminProducts({ query: tag });
    await sql`delete from product_stock where product_id = ${product.id}`;
    await admin.setStock({ productId: product.id, expected: 0, quantity: 2 });
    expect(await stockOf(product.id)).toBe(2);
    await expect(
      admin.setStock({ productId: 999_999, expected: 0, quantity: 1 }),
    ).rejects.toBeInstanceOf(admin.NotFoundError);
  });

  it("lists inventory with units on hold in pending checkouts", async () => {
    const [product] = await q.getAdminProducts({ query: tag });
    const orderId = crypto.randomUUID();
    await sql`insert into orders (id, user_id, status, subtotal_cents, expires_at)
              values (${orderId}, ${userId}, 'pending', 0, now() + interval '30 minutes')`;
    await sql`insert into order_items (order_id, product_id, product_name, product_sku, unit_price_cents, quantity)
              values (${orderId}, ${product.id}, 'x', 'x', 0, 3)`;

    const low = await q.getInventory({ status: "low-stock" });
    expect(low.find((r) => r.id === product.id)).toMatchObject({
      available: 2,
      onHold: 3,
    });
    const soldOut = await q.getInventory({ status: "sold-out" });
    expect(soldOut.some((r) => r.id === product.id)).toBe(false);
  });

  it("lists every customer's orders by status, and finds any order", async () => {
    const [mine] = await sql`select id from orders where user_id = ${userId}`;
    const pending = await q.getAdminOrders({ statuses: ["pending"], page: 1 });
    expect(pending.orders.find((o) => o.id === mine.id)).toMatchObject({
      customerEmail: `${userId}@example.test`,
      itemCount: 3,
    });
    const paid = await q.getAdminOrders({ statuses: ["paid"], page: 1 });
    expect(paid.orders.some((o) => o.id === mine.id)).toBe(false);

    const order = await q.getAdminOrder(mine.id as string);
    expect(order).toMatchObject({
      status: "pending",
      customer: { id: userId, name: "Admin Test" },
    });
    expect(order?.lines).toHaveLength(1);
  });

  it("manages categories and refuses to delete one with products", async () => {
    const id = await admin.createCategory({
      name: "Test",
      slug: `test-category-${tag}`,
      description: "Testing.",
    });
    const categories = await q.getAdminCategories();
    expect(categories.at(-1)).toMatchObject({ id, productCount: 0 });

    await expect(
      admin.createCategory({ name: "Dup", slug: "bags", description: "x" }),
    ).rejects.toMatchObject({ field: "slug" });

    await admin.updateCategory(id, {
      name: "Renamed",
      slug: `test-category-${tag}`,
      description: "Still testing.",
      position: 5,
    });
    expect(await q.getAdminCategory(id)).toMatchObject({
      name: "Renamed",
      position: 5,
    });

    await expect(admin.deleteCategory(bagsId)).rejects.toBeInstanceOf(
      admin.CategoryInUseError,
    );
    await admin.deleteCategory(id);
    expect(await q.getAdminCategory(id)).toBeUndefined();
    await expect(admin.deleteCategory(id)).rejects.toBeInstanceOf(
      admin.NotFoundError,
    );
  });
});
