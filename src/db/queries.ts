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
import { users } from "@/db/auth-schema";
import {
  categories,
  orderItems,
  orders,
  productStock,
  products,
  stockMovements,
} from "@/db/schema";
import { type CatalogFilters, LOW_STOCK_THRESHOLD } from "@/lib/catalog";
import { staleCutoff } from "@/lib/checkout";
import { escapeLike, searchTerms } from "@/lib/search";
import { HISTORY_STATUSES } from "@/lib/orders";
import type {
  AdminCategory,
  AdminOrder,
  AdminOrderListItem,
  AdminProduct,
  InventoryRow,
  StockMovement,
} from "@/types/admin";
import type {
  Category,
  Order,
  OrderLine,
  OrderListItem,
  OrderStatus,
  Product,
} from "@/types/catalog";

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
  // Every product has a stock row; coalesce is only a safety net.
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
  return { ...order, lines: await orderLines(order.id) };
}

/** An order's lines: snapshot name, SKU and price, plus the product's image. */
async function orderLines(orderId: string): Promise<OrderLine[]> {
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
    .where(eq(orderItems.orderId, orderId))
    .orderBy(asc(orderItems.productId));

  return lines.map(({ imageUrl, imageAlt, imageFit, ...line }) => ({
    ...line,
    image: { src: imageUrl, alt: imageAlt, fit: imageFit },
  }));
}

/** Columns of an order-history row (`OrderListItem`). */
const orderListColumns = {
  id: orders.id,
  status: orders.status,
  createdAt: orders.createdAt,
  itemCount: sql<number>`(
    select coalesce(sum(${orderItems.quantity}), 0)
    from ${orderItems} where ${orderItems.orderId} = ${orders.id}
  )`.mapWith(Number),
  totalCents:
    sql<number>`coalesce(${orders.totalCents}, ${orders.subtotalCents})`.mapWith(
      Number,
    ),
};

/** The user's order history, newest first; never other users' orders. */
export async function getOrdersForUser(
  userId: string,
): Promise<OrderListItem[]> {
  return db
    .select(orderListColumns)
    .from(orders)
    .where(
      and(
        eq(orders.userId, userId),
        inArray(orders.status, [...HISTORY_STATUSES]),
      ),
    )
    .orderBy(desc(orders.createdAt));
}

// Admin reads. Pages call these only after `requireAdmin`; they are not
// scoped to a user and must never back a customer-facing page.

function selectAdminProducts() {
  return db
    .select({
      ...productColumns,
      categoryId: products.categoryId,
      position: products.position,
    })
    .from(products)
    .innerJoin(categories, eq(products.categoryId, categories.id))
    .leftJoin(productStock, eq(productStock.productId, products.id));
}

function toAdminProduct({
  categoryId,
  position,
  ...row
}: Awaited<ReturnType<typeof selectAdminProducts>>[number]): AdminProduct {
  return { ...toProduct(row), categoryId, position };
}

/** Name, SKU or slug contains every term (case-insensitive). */
function adminProductSearch(query: string | undefined) {
  const text = sql`concat_ws(' ', ${products.name}, ${products.sku}, ${products.slug})`;
  return searchTerms(query ?? "").map((term) =>
    ilike(text, `%${escapeLike(term)}%`),
  );
}

/** Every product in "Recommended" order, optionally narrowed. */
export async function getAdminProducts({
  category,
  query,
}: {
  category?: string;
  query?: string;
}): Promise<AdminProduct[]> {
  const rows = await selectAdminProducts()
    .where(
      and(
        category ? eq(categories.slug, category) : undefined,
        ...adminProductSearch(query),
      ),
    )
    .orderBy(asc(products.position), asc(products.id));
  return rows.map(toAdminProduct);
}

export async function getAdminProduct(
  id: number,
): Promise<AdminProduct | undefined> {
  const [row] = await selectAdminProducts().where(eq(products.id, id)).limit(1);
  return row && toAdminProduct(row);
}

function selectAdminCategories() {
  return db
    .select({
      id: categories.id,
      slug: categories.slug,
      name: categories.name,
      description: categories.description,
      position: categories.position,
      productCount: sql<number>`count(${products.id})`.mapWith(Number),
    })
    .from(categories)
    .leftJoin(products, eq(products.categoryId, categories.id))
    .groupBy(categories.id);
}

export async function getAdminCategories(): Promise<AdminCategory[]> {
  return selectAdminCategories().orderBy(
    asc(categories.position),
    asc(categories.id),
  );
}

export async function getAdminCategory(
  id: number,
): Promise<AdminCategory | undefined> {
  const [row] = await selectAdminCategories().where(eq(categories.id, id));
  return row;
}

const available = sql<number>`coalesce(${productStock.quantity}, 0)`;

/**
 * Units each product has in unfinished checkouts. All were deducted from
 * `product_stock` at reservation: `onHold` (pending, still within the
 * reservation), `staleHolds` (pending past it, waiting for the expiry
 * webhook or the sweep) and `processing` (delayed payment clearing).
 */
const holds = db
  .select({
    productId: orderItems.productId,
    onHold:
      sql<number>`coalesce(sum(${orderItems.quantity}) filter (where ${orders.status} = 'pending' and ${orders.expiresAt} > now()), 0)`.as(
        "on_hold",
      ),
    staleHolds:
      sql<number>`coalesce(sum(${orderItems.quantity}) filter (where ${orders.status} = 'pending' and ${orders.expiresAt} <= now()), 0)`.as(
        "stale_holds",
      ),
    processing:
      sql<number>`coalesce(sum(${orderItems.quantity}) filter (where ${orders.status} = 'processing'), 0)`.as(
        "processing",
      ),
  })
  .from(orderItems)
  .innerJoin(orders, eq(orders.id, orderItems.orderId))
  .where(inArray(orders.status, ["pending", "processing"]))
  .groupBy(orderItems.productId)
  .as("holds");

export const INVENTORY_PAGE_SIZE = 50;

function stockStatusFilter(status: "low-stock" | "sold-out" | undefined) {
  if (status === "sold-out") return sql`${available} <= 0`;
  if (status === "low-stock")
    return sql`${available} between 1 and ${LOW_STOCK_THRESHOLD}`;
}

function selectInventory() {
  return db
    .select({
      id: products.id,
      slug: products.slug,
      name: products.name,
      sku: products.sku,
      categoryName: categories.name,
      imageUrl: products.imageUrl,
      imageAlt: products.imageAlt,
      imageFit: products.imageFit,
      available: available.mapWith(Number),
      onHold: sql<number>`coalesce(${holds.onHold}, 0)`.mapWith(Number),
      staleHolds: sql<number>`coalesce(${holds.staleHolds}, 0)`.mapWith(Number),
      processing: sql<number>`coalesce(${holds.processing}, 0)`.mapWith(Number),
    })
    .from(products)
    .innerJoin(categories, eq(products.categoryId, categories.id))
    .leftJoin(productStock, eq(productStock.productId, products.id))
    .leftJoin(holds, eq(holds.productId, products.id));
}

function toInventoryRow({
  imageUrl,
  imageAlt,
  imageFit,
  ...row
}: Awaited<ReturnType<typeof selectInventory>>[number]): InventoryRow {
  return { ...row, image: { src: imageUrl, alt: imageAlt, fit: imageFit } };
}

/**
 * Stock per product in "Recommended" order, one page at a time, optionally
 * narrowed by stock status, category and name/SKU/slug search.
 */
export async function getInventory({
  status,
  category,
  query,
  page,
}: {
  status?: "low-stock" | "sold-out";
  category?: string;
  query?: string;
  /** 1-based. */
  page: number;
}): Promise<{ rows: InventoryRow[]; hasNextPage: boolean }> {
  const rows = await selectInventory()
    .where(
      and(
        stockStatusFilter(status),
        category ? eq(categories.slug, category) : undefined,
        ...adminProductSearch(query),
      ),
    )
    .orderBy(asc(products.position), asc(products.id))
    // One extra row tells whether there is a next page.
    .limit(INVENTORY_PAGE_SIZE + 1)
    .offset((page - 1) * INVENTORY_PAGE_SIZE);

  return {
    rows: rows.slice(0, INVENTORY_PAGE_SIZE).map(toInventoryRow),
    hasNextPage: rows.length > INVENTORY_PAGE_SIZE,
  };
}

/** One product's stock and holds (the product page's Availability section). */
export async function getInventoryItem(
  productId: number,
): Promise<InventoryRow | undefined> {
  const [row] = await selectInventory()
    .where(eq(products.id, productId))
    .limit(1);
  return row && toInventoryRow(row);
}

/**
 * Catalog-wide stock counts for the admin overview, in one query.
 * `staleHolds` counts exactly what the sweep would pick up (past the grace
 * period, not flagged); `needsReconcile` the checkouts it flagged because
 * Stripe completed them without our webhook.
 */
export async function getInventoryCounts() {
  const cutoff = staleCutoff().toISOString();
  const [row] = await db
    .select({
      products: sql<number>`count(*)`.mapWith(Number),
      soldOut:
        sql<number>`count(*) filter (where ${stockStatusFilter("sold-out")})`.mapWith(
          Number,
        ),
      lowStock:
        sql<number>`count(*) filter (where ${stockStatusFilter("low-stock")})`.mapWith(
          Number,
        ),
      staleHolds: sql<number>`(
        select count(*) from ${orders}
        where ${orders.status} = 'pending' and ${orders.expiresAt} < ${cutoff}
          and ${orders.reconcileNeededAt} is null
      )`.mapWith(Number),
      needsReconcile: sql<number>`(
        select count(*) from ${orders}
        where ${orders.status} = 'pending'
          and ${orders.reconcileNeededAt} is not null
      )`.mapWith(Number),
    })
    .from(products)
    .leftJoin(productStock, eq(productStock.productId, products.id));
  return row;
}

/** A product's latest stock changes, newest first, with the admin's name. */
export async function getStockMovements(
  productId: number,
  limit = 20,
): Promise<StockMovement[]> {
  return db
    .select({
      id: stockMovements.id,
      delta: stockMovements.delta,
      quantityAfter: stockMovements.quantityAfter,
      reason: stockMovements.reason,
      orderId: stockMovements.orderId,
      note: stockMovements.note,
      actorName: users.name,
      createdAt: stockMovements.createdAt,
    })
    .from(stockMovements)
    .leftJoin(users, eq(users.id, stockMovements.actorUserId))
    .where(eq(stockMovements.productId, productId))
    .orderBy(desc(stockMovements.createdAt), desc(stockMovements.id))
    .limit(limit);
}

export const ADMIN_ORDERS_PAGE_SIZE = 50;

/** All customers' orders, newest first, one page at a time. */
export async function getAdminOrders({
  statuses,
  page,
}: {
  /** Undefined: every status. */
  statuses?: readonly OrderStatus[];
  /** 1-based. */
  page: number;
}): Promise<{ orders: AdminOrderListItem[]; hasNextPage: boolean }> {
  const rows = await db
    .select({
      ...orderListColumns,
      customerName: users.name,
      customerEmail: users.email,
    })
    .from(orders)
    .innerJoin(users, eq(users.id, orders.userId))
    .where(statuses ? inArray(orders.status, [...statuses]) : undefined)
    .orderBy(desc(orders.createdAt), asc(orders.id))
    // One extra row tells whether there is a next page.
    .limit(ADMIN_ORDERS_PAGE_SIZE + 1)
    .offset((page - 1) * ADMIN_ORDERS_PAGE_SIZE);
  return {
    orders: rows.slice(0, ADMIN_ORDERS_PAGE_SIZE),
    hasNextPage: rows.length > ADMIN_ORDERS_PAGE_SIZE,
  };
}

/** Any customer's order, in any status, with its lines. */
export async function getAdminOrder(
  orderId: string,
): Promise<AdminOrder | undefined> {
  const [row] = await db
    .select({
      id: orders.id,
      status: orders.status,
      subtotalCents: orders.subtotalCents,
      totalCents: orders.totalCents,
      email: orders.email,
      shipping: orders.shipping,
      createdAt: orders.createdAt,
      stripeCheckoutSessionId: orders.stripeCheckoutSessionId,
      stripePaymentIntentId: orders.stripePaymentIntentId,
      paidAt: orders.paidAt,
      expiresAt: orders.expiresAt,
      customerId: users.id,
      customerName: users.name,
      customerEmail: users.email,
    })
    .from(orders)
    .innerJoin(users, eq(users.id, orders.userId))
    .where(eq(orders.id, orderId))
    .limit(1);
  if (!row) return undefined;

  const { customerId, customerName, customerEmail, ...order } = row;
  return {
    ...order,
    customer: { id: customerId, name: customerName, email: customerEmail },
    lines: await orderLines(order.id),
  };
}
