import "server-only";

import {
  and,
  asc,
  desc,
  eq,
  ilike,
  inArray,
  ne,
  sql,
  type SQL,
} from "drizzle-orm";
import { cache } from "react";

import { db } from "@/db";
import {
  categories,
  orderItems,
  orders,
  productStock,
  products,
} from "@/db/schema";
import type { CatalogFilters } from "@/lib/catalog";
import { escapeLike, searchTerms } from "@/lib/search";
import type { Category, Order, Product } from "@/types/catalog";

/** Columns every product query selects; mapped to the UI `Product` type. */
const productColumns = {
  id: products.id,
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

/** Each search term must appear in one of these (case-insensitive). */
const searchableText = sql`concat_ws(' ', ${products.name}, ${categories.name}, ${products.color}, ${products.description}, array_to_string(${products.details}, ' '))`;

/**
 * Relevance of a product for the search terms: per term, a name match
 * weighs most, then category, colour, and description/details.
 */
function relevance(patterns: string[]) {
  const perTerm = patterns.map(
    (p) => sql`(
      case when ${products.name} ilike ${p} then 8 else 0 end +
      case when ${categories.name} ilike ${p} then 4 else 0 end +
      case when ${products.color}::text ilike ${p} then 2 else 0 end +
      case when ${products.description} ilike ${p}
        or array_to_string(${products.details}, ' ') ilike ${p} then 1 else 0 end
    )`,
  );
  return sql.join(perTerm, sql` + `);
}

/**
 * Catalog listing and search. With `filters.query`, only products matching
 * every term are returned, and the default sort ranks by relevance.
 */
export async function getProducts(filters: CatalogFilters): Promise<Product[]> {
  const patterns = searchTerms(filters.query ?? "").map(
    (term) => `%${escapeLike(term)}%`,
  );
  if (filters.query !== undefined && !patterns.length) return [];

  const order =
    patterns.length && filters.sort === "recommended"
      ? [desc(relevance(patterns)), asc(products.position)]
      : orderBy[filters.sort];

  const rows = await selectProducts()
    .where(
      and(
        filters.category ? eq(categories.slug, filters.category) : undefined,
        filters.colors.length
          ? inArray(products.color, filters.colors)
          : undefined,
        ...patterns.map((p) => ilike(searchableText, p)),
      ),
    )
    .orderBy(...order);
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

/**
 * Products in the shopper's bag with live price and stock. Not cached:
 * every bag read and bag action re-checks against the database.
 */
export async function getBagProducts(ids: number[]): Promise<Product[]> {
  if (!ids.length) return [];
  const rows = await selectProducts().where(inArray(products.id, ids));
  return rows.map(toProduct);
}

/** Products flagged new, in merchandised order; all of them when no limit. */
export async function getNewArrivals(limit?: number): Promise<Product[]> {
  const query = selectProducts()
    .where(eq(products.isNew, true))
    .orderBy(asc(products.position))
    .$dynamic();
  const rows = await (limit ? query.limit(limit) : query);
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

/**
 * One of the user's own orders with its lines, found by order id or by its
 * Stripe Checkout Session id (what Stripe's success redirect carries).
 */
export async function getOrderForUser(
  key: { orderId: string } | { sessionId: string },
  userId: string,
): Promise<Order | undefined> {
  const [order] = await db
    .select({
      id: orders.id,
      status: orders.status,
      subtotalCents: orders.subtotalCents,
      totalCents: orders.totalCents,
      email: orders.email,
      shipping: orders.shipping,
      createdAt: orders.createdAt,
    })
    .from(orders)
    .where(
      and(
        "orderId" in key
          ? eq(orders.id, key.orderId)
          : eq(orders.stripeCheckoutSessionId, key.sessionId),
        eq(orders.userId, userId),
      ),
    )
    .limit(1);
  if (!order) return undefined;

  const lines = await db
    .select({
      productId: orderItems.productId,
      slug: products.slug,
      name: orderItems.productName,
      sku: orderItems.productSku,
      imageUrl: products.imageUrl,
      imageAlt: products.imageAlt,
      imageFit: products.imageFit,
      unitPriceCents: orderItems.unitPriceCents,
      quantity: orderItems.quantity,
    })
    .from(orderItems)
    .innerJoin(products, eq(products.id, orderItems.productId))
    .where(eq(orderItems.orderId, order.id))
    .orderBy(asc(orderItems.productId));

  return {
    ...order,
    lines: lines.map(({ imageUrl, imageAlt, imageFit, ...line }) => ({
      ...line,
      image: { src: imageUrl, alt: imageAlt, fit: imageFit },
    })),
  };
}
