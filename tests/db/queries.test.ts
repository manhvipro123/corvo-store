import { neon } from "@neondatabase/serverless";
import { eq, sql } from "drizzle-orm";
import { drizzle } from "drizzle-orm/neon-http";
import { beforeAll, describe, expect, it } from "vitest";

import { defaultFilters } from "@/lib/catalog";

const url = process.env.TEST_DATABASE_URL;

describe.skipIf(!url)("catalog queries (test database)", () => {
  // Loaded in a hook, not at collection time: describe callbacks run even
  // when skipped, and src/db/index.ts throws without a database URL.
  let q: typeof import("@/db/queries");
  let schema: typeof import("@/db/schema");
  let db: ReturnType<typeof drizzle<typeof import("@/db/schema")>>;

  beforeAll(async () => {
    q = await import("@/db/queries");
    schema = await import("@/db/schema");
    db = drizzle(neon(url!), { schema });
  });

  it("lists categories in tab order", async () => {
    const categories = await q.getCategories();
    expect(categories.map((c) => c.slug)).toEqual([
      "ready-to-wear",
      "bags",
      "shoes",
      "accessories",
      "jewelry",
    ]);
  });

  it("returns all products in recommended order", async () => {
    const products = await q.getProducts(defaultFilters);
    expect(products).toHaveLength(18);
    expect(products[0].slug).toBe("top-handle-bag-cognac");
    expect(products[0]).toMatchObject({
      category: "bags",
      categoryName: "Bags",
      priceCents: 265000,
      image: { fit: "contain" },
    });
  });

  it("filters by category and colour", async () => {
    expect(
      await q.getProducts({ ...defaultFilters, category: "bags" }),
    ).toHaveLength(4);
    expect(
      await q.getProducts({ ...defaultFilters, colors: ["black"] }),
    ).toHaveLength(6);
    expect(
      await q.getProducts({
        ...defaultFilters,
        category: "jewelry",
        colors: ["black"],
      }),
    ).toHaveLength(0);
  });

  it("sorts by price and newness", async () => {
    const asc = await q.getProducts({ ...defaultFilters, sort: "price-asc" });
    expect(asc[0].slug).toBe("card-case-noir");
    expect(asc.map((p) => p.priceCents)).toEqual(
      asc.map((p) => p.priceCents).toSorted((a, b) => a - b),
    );

    const newest = await q.getProducts({ ...defaultFilters, sort: "newest" });
    expect(newest.slice(0, 6).every((p) => p.isNew)).toBe(true);
    expect(newest[6].isNew).toBe(false);
  });

  it("finds a product by slug with its stock", async () => {
    const rings = await q.getProductBySlug("stacking-rings-gold");
    expect(rings?.stock).toBe(0);
    expect(rings?.details.length).toBeGreaterThan(0);
    expect(await q.getProductBySlug("does-not-exist")).toBeUndefined();
  });

  it("keeps editorial selections in the given order", async () => {
    const slugs = ["tote-tan", "structured-satchel-dove", "missing"];
    const products = await q.getProductsBySlugs(slugs);
    expect(products.map((p) => p.slug)).toEqual(slugs.slice(0, 2));
  });

  it("returns the four newest arrivals by position", async () => {
    const products = await q.getNewArrivals(4);
    expect(products.map((p) => p.slug)).toEqual([
      "top-handle-bag-cognac",
      "slouch-bag-noir",
      "slingback-pump-noir",
      "acetate-sunglasses-black",
    ]);
  });

  it("puts same-category products first in related", async () => {
    const product = (await q.getProductBySlug("slingback-pump-noir"))!;
    const related = await q.getRelatedProducts(product, 4);
    expect(related.map((p) => p.slug)).not.toContain(product.slug);
    expect(related.slice(0, 2).every((p) => p.category === "shoes")).toBe(true);
  });

  describe("constraints", () => {
    it("rejects a negative price", async () => {
      await expect(
        db
          .update(schema.products)
          .set({ priceCents: -1 })
          .where(eq(schema.products.slug, "tote-tan")),
      ).rejects.toThrow();
    });

    it("rejects negative stock", async () => {
      await expect(
        db.update(schema.productStock).set({ quantity: -1 }),
      ).rejects.toThrow();
    });

    it("rejects a duplicate slug", async () => {
      await expect(
        db
          .update(schema.products)
          .set({ slug: "tote-tan" })
          .where(eq(schema.products.slug, "card-case-noir")),
      ).rejects.toThrow();
    });

    it("blocks deleting a category that still has products", async () => {
      await expect(
        db.delete(schema.categories).where(eq(schema.categories.slug, "bags")),
      ).rejects.toThrow();
    });

    // global-setup reseeds before every run, so these may delete freely.
    it("treats a product without a stock row as sold out", async () => {
      await db.execute(
        sql`delete from product_stock where product_id = (select id from products where slug = 'poplin-shirt-white')`,
      );
      expect((await q.getProductBySlug("poplin-shirt-white"))?.stock).toBe(0);
    });

    it("deletes a product's stock row with the product", async () => {
      await db
        .delete(schema.products)
        .where(eq(schema.products.slug, "overshirt-khaki"));
      const { rows } = await db.execute(
        sql`select count(*)::int as n from product_stock where product_id not in (select id from products)`,
      );
      expect(rows[0].n).toBe(0);
      expect(await q.getProductBySlug("overshirt-khaki")).toBeUndefined();
    });
  });
});
