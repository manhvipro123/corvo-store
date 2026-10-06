import "server-only";

import { eq, sql } from "drizzle-orm";

import { db } from "@/db";
import { categories, productStock, products } from "@/db/schema";
import type {
  CategoryInput,
  ProductInput,
  StockInput,
} from "@/lib/admin-validation";

/**
 * Catalog writes for the admin area. Callers (Server Actions) check
 * `requireAdmin` first; nothing here knows who is asking.
 */

/** A unique column (slug or SKU) already holds this value. */
export class UniqueViolationError extends Error {
  constructor(readonly field: "slug" | "sku") {
    super(`That ${field} is already in use.`);
  }
}

export class NotFoundError extends Error {
  constructor() {
    super("The record no longer exists.");
  }
}

/** The product's category doesn't exist (any more). */
export class UnknownCategoryError extends Error {
  constructor() {
    super("Unknown category.");
  }
}

/** Products still belong to the category (`products.category_id` restricts). */
export class CategoryInUseError extends Error {
  constructor() {
    super("The category still has products.");
  }
}

/** Stock moved (e.g. a checkout reserved some) since the admin loaded it. */
export class StockChangedError extends Error {
  constructor(readonly current: number) {
    super("Stock changed since it was loaded.");
  }
}

/** The Postgres error behind a Drizzle/Neon error, if any. */
function pgError(error: unknown) {
  for (let e = error; e && typeof e === "object"; e = (e as Error).cause) {
    const { code, constraint } = e as { code?: unknown; constraint?: unknown };
    if (typeof code === "string" && /^[0-9A-Z]{5}$/.test(code))
      return { code, constraint: String(constraint ?? "") };
  }
}

/** Maps constraint failures to the errors above; rethrows anything else. */
function translate(error: unknown): never {
  const pg = pgError(error);
  if (pg?.code === "23505") {
    if (pg.constraint.endsWith("_sku_unique"))
      throw new UniqueViolationError("sku");
    if (pg.constraint.endsWith("_slug_unique"))
      throw new UniqueViolationError("slug");
  }
  if (pg?.code === "23503") {
    if (pg.constraint === "products_category_id_categories_id_fk")
      throw new UnknownCategoryError();
  }
  throw error;
}

/** After everything else, leaving a gap so items can be slotted in. */
const nextPosition = (table: typeof products | typeof categories) =>
  sql`(select coalesce(max(${table.position}), 0) + 10 from ${table})`;

const productValues = ({ position, ...input }: ProductInput) => ({
  ...input,
  ...(position === undefined ? {} : { position }),
});

/**
 * Inserts the product and its starting stock row in one transaction (`db.batch`):
 * the stock insert finds the new row by its (unique) slug.
 */
export async function createProduct(
  input: ProductInput,
  stock: number,
): Promise<number> {
  try {
    const [[created]] = await db.batch([
      db
        .insert(products)
        .values({
          ...productValues(input),
          position: input.position ?? nextPosition(products),
        })
        .returning({ id: products.id }),
      db.insert(productStock).select(
        db
          .select({
            productId: products.id,
            quantity: sql<number>`${stock}::integer`.as("quantity"),
            updatedAt: sql<Date>`now()`.as("updated_at"),
          })
          .from(products)
          .where(eq(products.slug, input.slug)),
      ),
    ]);
    return created.id;
  } catch (error) {
    translate(error);
  }
}

/** Updates the catalog fields; stock is changed only through `setStock`. */
export async function updateProduct(id: number, input: ProductInput) {
  let updated: { id: number }[];
  try {
    updated = await db
      .update(products)
      .set(productValues(input))
      .where(eq(products.id, id))
      .returning({ id: products.id });
  } catch (error) {
    translate(error);
  }
  if (!updated.length) throw new NotFoundError();
}

export async function createCategory(input: CategoryInput): Promise<number> {
  try {
    const [created] = await db
      .insert(categories)
      .values({
        ...input,
        position: input.position ?? nextPosition(categories),
      })
      .returning({ id: categories.id });
    return created.id;
  } catch (error) {
    translate(error);
  }
}

export async function updateCategory(id: number, input: CategoryInput) {
  const { position, ...rest } = input;
  let updated: { id: number }[];
  try {
    updated = await db
      .update(categories)
      .set({ ...rest, ...(position === undefined ? {} : { position }) })
      .where(eq(categories.id, id))
      .returning({ id: categories.id });
  } catch (error) {
    translate(error);
  }
  if (!updated.length) throw new NotFoundError();
}

/** Only an empty category can go; products are never deleted with it. */
export async function deleteCategory(id: number) {
  let deleted: { id: number }[];
  try {
    deleted = await db
      .delete(categories)
      .where(eq(categories.id, id))
      .returning({ id: categories.id });
  } catch (error) {
    // ON DELETE RESTRICT raises restrict_violation, not foreign_key_violation.
    if (pgError(error)?.code === "23001") throw new CategoryInUseError();
    throw error;
  }
  if (!deleted.length) throw new NotFoundError();
}

/**
 * Sets a product's available quantity, but only if it still is what the
 * admin saw (`expected`): a checkout that reserved units in the meantime
 * must not be overwritten. A missing stock row counts as 0 and is created.
 */
export async function setStock({ productId, expected, quantity }: StockInput) {
  let written: { quantity: number }[];
  try {
    written = await db
      .insert(productStock)
      .values({ productId, quantity })
      .onConflictDoUpdate({
        target: productStock.productId,
        set: { quantity, updatedAt: sql`now()` },
        setWhere: eq(productStock.quantity, expected),
      })
      .returning({ quantity: productStock.quantity });
  } catch (error) {
    // No such product (the stock row's foreign key).
    if (pgError(error)?.code === "23503") throw new NotFoundError();
    throw error;
  }
  if (written.length) return;

  // No row written: the quantity no longer matches `expected`.
  const [current] = await db
    .select({ quantity: productStock.quantity })
    .from(productStock)
    .where(eq(productStock.productId, productId));
  throw new StockChangedError(current?.quantity ?? 0);
}
