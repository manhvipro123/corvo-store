/**
 * Resets the catalog tables and loads `seed-data.ts`. Destructive: for
 * development and test databases only. CLI entry: `run-seed.mts`.
 */
import { neon } from "@neondatabase/serverless";
import { sql } from "drizzle-orm";
import { drizzle } from "drizzle-orm/neon-http";

import {
  categories,
  orderItems,
  orders,
  productStock,
  products,
  stockMovements,
} from "./schema";
import { seedCategories, seedProducts } from "./seed-data";

/** Gap between positions so items can later be slotted in between. */
const POSITION_STEP = 10;

export async function seed(url: string) {
  // Own client: src/db/index.ts is server-only and can't run outside Next.
  const db = drizzle(neon(url));

  // One HTTP batch = one transaction: all of it applies, or none.
  // Orders go too: product ids restart, so old order lines would point at
  // the wrong pieces.
  await db.batch([
    db.execute(
      sql`truncate table ${stockMovements}, ${orderItems}, ${orders}, ${productStock}, ${products}, ${categories} restart identity cascade`,
    ),
    db.insert(categories).values(
      seedCategories.map((c, i) => ({
        ...c,
        position: (i + 1) * POSITION_STEP,
      })),
    ),
    db.insert(products).values(
      seedProducts.map((p, i) => ({
        categoryId: sql`(select ${categories.id} from ${categories} where ${categories.slug} = ${p.category})`,
        slug: p.slug,
        sku: p.sku,
        name: p.name,
        description: p.description,
        details: p.details,
        color: p.color,
        priceCents: p.priceCents,
        imageUrl: p.image.src,
        imageAlt: p.image.alt,
        imageFit: p.image.fit ?? "contain",
        isNew: p.isNew ?? false,
        position: (i + 1) * POSITION_STEP,
      })),
    ),
    db.insert(productStock).values(
      seedProducts.map((p) => ({
        productId: sql`(select ${products.id} from ${products} where ${products.slug} = ${p.slug})`,
        quantity: p.stock,
      })),
    ),
    // Opening balance, so sum(delta) per product equals its quantity.
    db.execute(sql`
      insert into ${stockMovements} (product_id, delta, quantity_after, reason, note)
      select product_id, quantity, quantity, 'initial', 'Seed data'
      from ${productStock} where quantity > 0
    `),
  ]);

  return {
    categories: seedCategories.length,
    products: seedProducts.length,
  };
}
