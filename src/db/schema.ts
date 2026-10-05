import { relations, sql } from "drizzle-orm";
import {
  boolean,
  check,
  index,
  integer,
  pgEnum,
  pgTable,
  text,
  timestamp,
} from "drizzle-orm/pg-core";

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

/** One row per product; a missing row is treated as sold out. */
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
