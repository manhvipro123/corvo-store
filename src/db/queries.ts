import "server-only";

import { and, asc, desc, eq, inArray, ne, sql, type SQL } from "drizzle-orm";
import { cache } from "react";

import { db } from "@/db";
import { categories, productStock, products } from "@/db/schema";
import type { CatalogFilters } from "@/lib/catalog";
import type { Category, Product } from "@/types/catalog";

/** Columns every product query selects; mapped to the UI `Product` type. */
const productColumns = {
  slug: products.slug,
  name: products.name,
  category: categories.slug,
  categoryName: categories.name,
  color: products.color,
  priceCents: products.priceCents,
  imageUrl: products.imageUrl,
  imageAlt: products.imageAlt,
  imageFit: products.imageFit,
  isNew: products.isNew,
  sku: products.sku,
  description: products.description,
  details: products.details,
  // A product without a stock row counts as sold out.
  stock: sql<number>`coalesce(${productStock.quantity}, 0)`.mapWith(Number),
};

function selectProducts() {
  return db
    .select(productColumns)
    .from(products)
    .innerJoin(categories, eq(products.categoryId, categories.id))
    .leftJoin(productStock, eq(productStock.productId, products.id));
}

type ProductRow = Awaited<ReturnType<typeof selectProducts>>[number];

function toProduct({
  imageUrl,
  imageAlt,
  imageFit,
  ...row
}: ProductRow): Product {
  return { ...row, image: { src: imageUrl, alt: imageAlt, fit: imageFit } };
}

const orderBy: Record<CatalogFilters["sort"], SQL[]> = {
  recommended: [asc(products.position)],
  newest: [desc(products.isNew), asc(products.position)],
  "price-asc": [asc(products.priceCents), asc(products.position)],
  "price-desc": [desc(products.priceCents), asc(products.position)],
};

export const getCategories = cache(async (): Promise<Category[]> => {
  return db
    .select({
      slug: categories.slug,
      name: categories.name,
      description: categories.description,
    })
    .from(categories)
    .orderBy(asc(categories.position));
});

export async function getProducts(filters: CatalogFilters): Promise<Product[]> {
  const rows = await selectProducts()
    .where(
      and(
        filters.category ? eq(categories.slug, filters.category) : undefined,
        filters.colors.length
          ? inArray(products.color, filters.colors)
          : undefined,
      ),
    )
    .orderBy(...orderBy[filters.sort]);
  return rows.map(toProduct);
}

/** Deduplicated per request, so `generateMetadata` and the page share one query. */
export const getProductBySlug = cache(
  async (slug: string): Promise<Product | undefined> => {
    const [row] = await selectProducts()
      .where(eq(products.slug, slug))
      .limit(1);
    return row && toProduct(row);
  },
);

/** Products in the given order (e.g. an editorial selection). */
export async function getProductsBySlugs(slugs: string[]): Promise<Product[]> {
  if (!slugs.length) return [];
  const rows = await selectProducts().where(inArray(products.slug, slugs));
  const bySlug = new Map(rows.map((row) => [row.slug, toProduct(row)]));
  return slugs.flatMap((slug) => bySlug.get(slug) ?? []);
}

export async function getNewArrivals(limit = 4): Promise<Product[]> {
  const rows = await selectProducts()
    .where(eq(products.isNew, true))
    .orderBy(asc(products.position))
    .limit(limit);
  return rows.map(toProduct);
}

/** Same-category pieces first, topped up from the rest of the catalog. */
export async function getRelatedProducts(
  product: Product,
  limit = 4,
): Promise<Product[]> {
  const rows = await selectProducts()
    .where(ne(products.slug, product.slug))
    .orderBy(
      sql`(${categories.slug} = ${product.category}) desc`,
      asc(products.position),
    )
    .limit(limit);
  return rows.map(toProduct);
}

export async function getProductSlugs(): Promise<string[]> {
  const rows = await db.select({ slug: products.slug }).from(products);
  return rows.map((row) => row.slug);
}
