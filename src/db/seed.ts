/**
 * Resets the catalog tables and loads `seed-data.ts`. Destructive: for
 * development and test databases only. CLI entry: `run-seed.mts`.
 */
import { neon } from "@neondatabase/serverless";
import { sql } from "drizzle-orm";
import { drizzle } from "drizzle-orm/neon-http";

import { categories, productStock, products } from "./schema";
import { seedCategories, seedProducts } from "./seed-data";

/** Gap between positions so items can later be slotted in between. */
const POSITION_STEP = 10;

export async function seed(url: string) {
  // Own client: src/db/index.ts is server-only and can't run outside Next.
  const db = drizzle(neon(url));

  // One HTTP batch = one transaction: all of it applies, or none.
  await db.batch([
    db.execute(
      sql`truncate table ${productStock}, ${products}, ${categories} restart identity cascade`,
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
  ]);

  return {
    categories: seedCategories.length,
    products: seedProducts.length,
  };
}
