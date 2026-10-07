import { relations, sql } from "drizzle-orm";
import {
  boolean,
  check,
  index,
  integer,
  jsonb,
  pgEnum,
  pgTable,
  primaryKey,
  text,
  timestamp,
  uniqueIndex,
} from "drizzle-orm/pg-core";

import type { Order } from "@/types/catalog";

import { users } from "./auth-schema";

export const productColor = pgEnum("product_color", [
  "black",
  "brown",
  "neutral",
  "grey",
  "white",
  "gold",
]);

export const imageFit = pgEnum("image_fit", ["contain", "cover"]);

const timestamps = {
  createdAt: timestamp("created_at", { withTimezone: true })
    .notNull()
    .defaultNow(),
  updatedAt: timestamp("updated_at", { withTimezone: true })
    .notNull()
    .defaultNow()
    .$onUpdate(() => new Date()),
};

export const categories = pgTable("categories", {
  id: integer("id").primaryKey().generatedAlwaysAsIdentity(),
  slug: text("slug").notNull().unique(),
  name: text("name").notNull(),
  description: text("description").notNull(),
  /** Tab order on /products. */
  position: integer("position").notNull().default(0),
  createdAt: timestamps.createdAt,
});

export const products = pgTable(
  "products",
  {
    id: integer("id").primaryKey().generatedAlwaysAsIdentity(),
    categoryId: integer("category_id")
      .notNull()
      .references(() => categories.id, { onDelete: "restrict" }),
    slug: text("slug").notNull().unique(),
    sku: text("sku").notNull().unique(),
    name: text("name").notNull(),
    description: text("description").notNull(),
    details: text("details")
      .array()
      .notNull()
      .default(sql`'{}'::text[]`),
    color: productColor("color").notNull(),
    /** Whole cents, USD. */
    priceCents: integer("price_cents").notNull(),
    imageUrl: text("image_url").notNull(),
    imageAlt: text("image_alt").notNull(),
    imageFit: imageFit("image_fit").notNull().default("contain"),
    isNew: boolean("is_new").notNull().default(false),
    /** Merchandised "Recommended" order (global, set by the merchant). */
    position: integer("position").notNull().default(0),
    ...timestamps,
  },
  (t) => [
    check("products_price_cents_non_negative", sql`${t.priceCents} >= 0`),
    index("products_category_id_idx").on(t.categoryId),
    index("products_position_idx").on(t.position),
  ],
);

/** One row per product (`createProduct` and migration 0004 guarantee it). */
export const productStock = pgTable(
  "product_stock",
  {
    productId: integer("product_id")
      .primaryKey()
      .references(() => products.id, { onDelete: "cascade" }),
    quantity: integer("quantity").notNull().default(0),
    updatedAt: timestamps.updatedAt,
  },
  (t) => [
    check("product_stock_quantity_non_negative", sql`${t.quantity} >= 0`),
  ],
);

/**
 * pending: stock reserved, awaiting payment. processing: Checkout completed,
 * delayed payment method still clearing. Only verified Stripe data moves an
 * order between states (see src/lib/checkout.ts).
 */
export const orderStatus = pgEnum("order_status", [
  "pending",
  "processing",
  "paid",
  "failed",
  "expired",
]);

/** Shipping details copied from the completed Checkout Session. */
export type OrderShipping = NonNullable<Order["shipping"]>;

export const orders = pgTable(
  "orders",
  {
    /** Server-generated UUID; also the Stripe idempotency key. */
    id: text("id").primaryKey(),
    userId: text("user_id")
      .notNull()
      .references(() => users.id, { onDelete: "restrict" }),
    status: orderStatus("status").notNull().default("pending"),
    /** Whole cents, USD, from our prices at checkout time. */
    subtotalCents: integer("subtotal_cents").notNull(),
    /** What Stripe charged (`amount_total`), set once paid. */
    totalCents: integer("total_cents"),
    stripeCheckoutSessionId: text("stripe_checkout_session_id").unique(),
    stripePaymentIntentId: text("stripe_payment_intent_id"),
    email: text("email"),
    shipping: jsonb("shipping").$type<OrderShipping>(),
    /** When the reservation (and the Checkout Session) lapses. */
    expiresAt: timestamp("expires_at", { withTimezone: true }).notNull(),
    paidAt: timestamp("paid_at", { withTimezone: true }),
    /**
     * Set by the stale-checkout sweep when Stripe reports the session
     * complete but no webhook has moved the order: it still holds stock and
     * the sweep skips it from then on. Settled by resending the event.
     */
    reconcileNeededAt: timestamp("reconcile_needed_at", { withTimezone: true }),
    /**
     * Last time the stale-checkout sweep picked the order up. The sweep takes
     * never-tried orders first, then the least recently tried, so orders it
     * keeps failing on (e.g. Stripe errors) can't hold up the rest.
     */
    sweepAttemptedAt: timestamp("sweep_attempted_at", { withTimezone: true }),
    ...timestamps,
  },
  (t) => [
    check("orders_subtotal_cents_non_negative", sql`${t.subtotalCents} >= 0`),
    check(
      "orders_total_cents_non_negative",
      sql`${t.totalCents} is null or ${t.totalCents} >= 0`,
    ),
    index("orders_user_id_idx").on(t.userId),
    index("orders_status_expires_at_idx").on(t.status, t.expiresAt),
    // One open checkout per user, even when two requests start one at once:
    // a second session for the same bag could be paid as well.
    uniqueIndex("orders_one_pending_per_user_idx")
      .on(t.userId)
      .where(sql`${t.status} = 'pending'`),
  ],
);

/** Price and name are snapshots: later catalog edits don't change orders. */
export const orderItems = pgTable(
  "order_items",
  {
    orderId: text("order_id")
      .notNull()
      .references(() => orders.id, { onDelete: "cascade" }),
    productId: integer("product_id")
      .notNull()
      .references(() => products.id, { onDelete: "restrict" }),
    productName: text("product_name").notNull(),
    productSku: text("product_sku").notNull(),
    unitPriceCents: integer("unit_price_cents").notNull(),
    quantity: integer("quantity").notNull(),
  },
  (t) => [
    primaryKey({ columns: [t.orderId, t.productId] }),
    check("order_items_quantity_positive", sql`${t.quantity} > 0`),
    check(
      "order_items_unit_price_cents_non_negative",
      sql`${t.unitPriceCents} >= 0`,
    ),
  ],
);

/** Stripe event ids already handled, so retried deliveries are skipped. */
export const stripeEvents = pgTable("stripe_events", {
  id: text("id").primaryKey(),
  type: text("type").notNull(),
  createdAt: timestamps.createdAt,
});

/**
 * Fixed-window attempt counters for the auth Server Actions (see
 * `src/lib/auth-rate-limit.ts`). Not related to any other table; rows whose
 * window ended long ago are pruned by the cron route.
 */
export const rateLimits = pgTable(
  "rate_limits",
  {
    /** "<action>:<ip|account>:<value>"; emails are SHA-256 hashed. */
    key: text("key").primaryKey(),
    count: integer("count").notNull(),
    windowStart: timestamp("window_start", { withTimezone: true })
      .notNull()
      .defaultNow(),
  },
  (t) => [index("rate_limits_window_start_idx").on(t.windowStart)],
);

/** Why a product's stock changed (see `stock_movements`). */
export const stockMovementReason = pgEnum("stock_movement_reason", [
  "initial",
  "admin_set",
  "admin_adjust",
  "reserve",
  "release",
]);

/**
 * Append-only history of `product_stock.quantity`. Every change writes one
 * row in the same statement or batch as the change itself, so per product
 * `sum(delta)` always equals the current quantity.
 */
export const stockMovements = pgTable(
  "stock_movements",
  {
    id: integer("id").primaryKey().generatedAlwaysAsIdentity(),
    productId: integer("product_id")
      .notNull()
      .references(() => products.id, { onDelete: "cascade" }),
    delta: integer("delta").notNull(),
    /** `product_stock.quantity` right after this change. */
    quantityAfter: integer("quantity_after").notNull(),
    reason: stockMovementReason("reason").notNull(),
    /** The checkout that reserved or released the units. */
    orderId: text("order_id").references(() => orders.id, {
      onDelete: "set null",
    }),
    /** Admin who made a manual change. No FK: auth tables stay separate. */
    actorUserId: text("actor_user_id"),
    note: text("note"),
    createdAt: timestamps.createdAt,
  },
  (t) => [
    check("stock_movements_delta_non_zero", sql`${t.delta} <> 0`),
    check(
      "stock_movements_quantity_after_non_negative",
      sql`${t.quantityAfter} >= 0`,
    ),
    check(
      "stock_movements_note_length",
      sql`${t.note} is null or char_length(${t.note}) <= 200`,
    ),
    index("stock_movements_product_id_created_at_idx").on(
      t.productId,
      t.createdAt.desc(),
    ),
  ],
);

export const categoriesRelations = relations(categories, ({ many }) => ({
  products: many(products),
}));

export const productsRelations = relations(products, ({ one }) => ({
  category: one(categories, {
    fields: [products.categoryId],
    references: [categories.id],
  }),
  stock: one(productStock, {
    fields: [products.id],
    references: [productStock.productId],
  }),
}));

export const productStockRelations = relations(productStock, ({ one }) => ({
  product: one(products, {
    fields: [productStock.productId],
    references: [products.id],
  }),
}));

export const ordersRelations = relations(orders, ({ many }) => ({
  items: many(orderItems),
}));

export const orderItemsRelations = relations(orderItems, ({ one }) => ({
  order: one(orders, {
    fields: [orderItems.orderId],
    references: [orders.id],
  }),
}));
