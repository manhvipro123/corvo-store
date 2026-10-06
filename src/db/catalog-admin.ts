import "server-only";

import { eq, sql } from "drizzle-orm";

import { db } from "@/db";
import {
  categories,
  productStock,
  products,
  stockMovements,
} from "@/db/schema";
import {
  type CategoryInput,
  type ProductInput,
  STOCK_MAX,
  type StockAdjustInput,
  type StockInput,
} from "@/lib/admin-validation";

/**
 * Catalog writes for the admin area. Callers (Server Actions) check
 * `requireAdmin` first and pass the admin's user id for the stock history.
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

/** A write-off larger than the units available. */
export class InsufficientStockError extends Error {
  constructor(readonly current: number) {
    super("Not enough stock to remove that many units.");
  }
}

/** An addition that would take stock above `STOCK_MAX`. */
export class StockLimitError extends Error {
  constructor(readonly current: number) {
    super("Stock would exceed the maximum.");
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
 * Inserts the product, its starting stock row and (for stock > 0) the
 * `initial` history row in one transaction (`db.batch`): the later inserts
 * find the new product by its (unique) slug.
 */
export async function createProduct(
  input: ProductInput,
  stock: number,
  actorUserId: string,
): Promise<number> {
  const opening = db.execute(sql`
    insert into ${stockMovements}
      (product_id, delta, quantity_after, reason, actor_user_id)
    select id, ${stock}, ${stock}, 'initial', ${actorUserId}
    from ${products} where slug = ${input.slug}
  `);
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
      ...(stock > 0 ? [opening] : []),
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

/** The product's stock quantity, or undefined when there is no such product. */
async function currentStock(productId: number) {
  const [row] = await db
    .select({ quantity: productStock.quantity })
    .from(productStock)
    .where(eq(productStock.productId, productId));
  return row?.quantity;
}

/**
 * Sets a product's available quantity, but only if it still is what the
 * admin saw (`expected`): a checkout that reserved or released units in the
 * meantime must not be overwritten. The change and its `admin_set` history
 * row are one statement; `delta` is exact because the write only happens
 * when the current quantity equals `expected`.
 */
export async function setStock(
  { productId, expected, quantity }: StockInput,
  actorUserId: string,
) {
  if (quantity !== expected) {
    const written = await db.execute(sql`
      with updated as (
        update ${productStock}
        set quantity = ${quantity}, updated_at = now()
        where product_id = ${productId} and quantity = ${expected}
        returning quantity
      )
      insert into ${stockMovements}
        (product_id, delta, quantity_after, reason, actor_user_id)
      select ${productId}, ${quantity - expected}, quantity, 'admin_set', ${actorUserId}
      from updated
      returning quantity_after
    `);
    if (written.rows.length) return;
  }

  // Nothing written (or nothing to change): say why, if anything is wrong.
  const current = await currentStock(productId);
  if (current === undefined) throw new NotFoundError();
  if (current !== expected) throw new StockChangedError(current);
}

/**
 * Adds `delta` units (negative to write some off). Combines safely with
 * concurrent reservations and releases, so no `expected` check is needed;
 * the non-negative check and `STOCK_MAX` bound the result.
 */
export async function adjustStock({
  productId,
  delta,
  note,
  actorUserId,
}: StockAdjustInput & { actorUserId: string }) {
  let written: { rows: unknown[] };
  try {
    written = await db.execute(sql`
      with updated as (
        update ${productStock}
        set quantity = quantity + ${delta}, updated_at = now()
        where product_id = ${productId}
          and (${delta} < 0 or quantity + ${delta} <= ${STOCK_MAX})
        returning quantity
      )
      insert into ${stockMovements}
        (product_id, delta, quantity_after, reason, actor_user_id, note)
      select ${productId}, ${delta}, quantity, 'admin_adjust', ${actorUserId}, ${note ?? null}
      from updated
      returning quantity_after
    `);
  } catch (error) {
    // `product_stock_quantity_non_negative`: more written off than there is.
    if (pgError(error)?.code === "23514")
      throw new InsufficientStockError((await currentStock(productId)) ?? 0);
    throw error;
  }
  if (written.rows.length) return;

  const current = await currentStock(productId);
  if (current === undefined) throw new NotFoundError();
  throw new StockLimitError(current);
}
