import "server-only";

import { and, asc, eq, inArray, isNotNull, isNull, lt, sql } from "drizzle-orm";

import { db } from "@/db";
import {
  type OrderShipping,
  orderItems,
  orders,
  productStock,
  stockMovements,
  stripeEvents,
} from "@/db/schema";
import {
  RESERVATION_HEADROOM_MS,
  RESERVATION_MINUTES,
  type ReservedLine,
  type Transition,
} from "@/lib/checkout";

/** Thrown when a line can't be reserved because stock ran out. */
export class OutOfStockError extends Error {
  constructor() {
    super("Not enough stock to reserve the order.");
  }
}

/** Postgres check_violation, possibly wrapped by Drizzle. */
function isCheckViolation(error: unknown): boolean {
  for (let e = error; e && typeof e === "object"; e = (e as Error).cause) {
    if ((e as { code?: string }).code === "23514") return true;
  }
  return false;
}

/**
 * Creates a pending order and reserves its stock in one transaction
 * (`db.batch`). Each decrement locks its stock row; if any would go below
 * zero, `product_stock_quantity_non_negative` fails and nothing is written.
 */
export async function reserveOrder({
  userId,
  lines,
}: {
  userId: string;
  lines: ReservedLine[];
}) {
  const id = crypto.randomUUID();
  const expiresAt = new Date(
    Date.now() + RESERVATION_MINUTES * 60_000 + RESERVATION_HEADROOM_MS,
  );
  const sorted = [...lines].sort((a, b) => a.productId - b.productId);
  const subtotalCents = sorted.reduce(
    (sum, l) => sum + l.unitPriceCents * l.quantity,
    0,
  );

  try {
    const [, , ...updates] = await db.batch([
      db.insert(orders).values({ id, userId, subtotalCents, expiresAt }),
      db.insert(orderItems).values(
        sorted.map((l) => ({
          orderId: id,
          productId: l.productId,
          productName: l.name,
          productSku: l.sku,
          unitPriceCents: l.unitPriceCents,
          quantity: l.quantity,
        })),
      ),
      // Same order (by product id) in every reservation, so two of them
      // can't deadlock on each other's rows. Each decrement writes its
      // `reserve` history row in the same statement.
      ...sorted.map((l) =>
        db.execute(sql`
          with updated as (
            update ${productStock}
            set quantity = quantity - ${l.quantity}, updated_at = now()
            where product_id = ${l.productId}
            returning product_id, quantity
          )
          insert into ${stockMovements}
            (product_id, delta, quantity_after, reason, order_id)
          select product_id, ${-l.quantity}, quantity, 'reserve', ${id}
          from updated
          returning product_id
        `),
      ),
    ]);
    // A product without a stock row updates nothing: undo and treat as sold out.
    if (updates.some((result) => result.rows.length === 0)) {
      await releaseOrder(id, { to: "expired", from: ["pending"] });
      throw new OutOfStockError();
    }
  } catch (error) {
    if (isCheckViolation(error)) throw new OutOfStockError();
    throw error;
  }

  return { id, expiresAt, subtotalCents };
}

/**
 * Attaches the session only while the order is still pending; false if it
 * was ended meanwhile, so its session must not be used.
 */
export async function attachCheckoutSession(
  orderId: string,
  sessionId: string,
) {
  const rows = await db
    .update(orders)
    .set({ stripeCheckoutSessionId: sessionId })
    .where(and(eq(orders.id, orderId), eq(orders.status, "pending")))
    .returning({ id: orders.id });
  return rows.length > 0;
}

/**
 * Moves the order to `to` if it is in one of `from`, and only then returns
 * its reserved stock and records `release` history rows. One statement, so
 * running it twice (retried webhooks, a cancel racing the expiry event or
 * the stale-checkout sweep) releases stock at most once. The stock rows are
 * locked by product id first, the same order `reserveOrder` takes them in,
 * so a release and a reservation sharing products can't deadlock.
 */
export function releaseOrder(
  orderId: string,
  { to, from }: Pick<Transition, "to" | "from">,
) {
  return db.execute(sql`
    with moved as (
      update ${orders}
      set status = ${to}, updated_at = now()
      where id = ${orderId} and status in ${from}
      returning id
    ),
    locked as (
      select s.product_id
      from ${productStock} s
      join ${orderItems} i on i.product_id = s.product_id
      join moved on moved.id = i.order_id
      order by s.product_id
      for update of s
    ),
    restored as (
      update ${productStock} s
      set quantity = s.quantity + i.quantity, updated_at = now()
      from ${orderItems} i
      join moved on moved.id = i.order_id
      join locked on locked.product_id = i.product_id
      where s.product_id = i.product_id
      returning s.product_id, i.quantity as delta, s.quantity as quantity_after, i.order_id
    )
    insert into ${stockMovements}
      (product_id, delta, quantity_after, reason, order_id)
    select product_id, delta, quantity_after, 'release', order_id
    from restored
    returning product_id
  `);
}

/**
 * Pending orders whose reservation ended before `before`: checkouts whose
 * `expired` webhook never arrived, or that never got a Stripe session.
 * Orders the sweep never tried come first (oldest first), then the least
 * recently tried, so ones it keeps failing on rotate to the back instead of
 * filling every batch. Orders already flagged by `markReconcileNeeded` are
 * left out. Uses `orders_status_expires_at_idx`.
 */
export async function getStalePendingOrders(before: Date, limit: number) {
  return db
    .select({
      id: orders.id,
      stripeCheckoutSessionId: orders.stripeCheckoutSessionId,
    })
    .from(orders)
    .where(
      and(
        eq(orders.status, "pending"),
        lt(orders.expiresAt, before),
        isNull(orders.reconcileNeededAt),
      ),
    )
    .orderBy(
      sql`${orders.sweepAttemptedAt} asc nulls first`,
      asc(orders.expiresAt),
    )
    .limit(limit);
}

/** Records that the sweep picked these orders up (see `getStalePendingOrders`). */
export async function markSweepAttempted(orderIds: string[]) {
  if (!orderIds.length) return;
  await db
    .update(orders)
    .set({ sweepAttemptedAt: new Date() })
    .where(inArray(orders.id, orderIds));
}

/**
 * The user's pending orders that have a Stripe session, including ones
 * flagged by `markReconcileNeeded` (paid at Stripe, webhook missing), so
 * checkout can refuse to charge the same bag again. Orders still waiting for
 * their session are left out: another request is creating it right now
 * (`createCheckout` releases them if that fails, the sweep if it never
 * finishes). Uses `orders_user_id_idx`.
 */
export async function getPendingOrdersForUser(userId: string) {
  return db
    .select({
      id: orders.id,
      stripeCheckoutSessionId: orders.stripeCheckoutSessionId,
      reconcileNeeded: sql<boolean>`${orders.reconcileNeededAt} is not null`,
    })
    .from(orders)
    .where(
      and(
        eq(orders.userId, userId),
        eq(orders.status, "pending"),
        isNotNull(orders.stripeCheckoutSessionId),
      ),
    );
}

/**
 * Flags a pending order whose Stripe session completed without its webhook
 * reaching us. Only a resent webhook may settle it (paid, or released if the
 * payment failed); the flag just takes it out of the sweep.
 */
export function markReconcileNeeded(orderId: string) {
  return db
    .update(orders)
    .set({ reconcileNeededAt: new Date() })
    .where(
      and(
        eq(orders.id, orderId),
        eq(orders.status, "pending"),
        isNull(orders.reconcileNeededAt),
      ),
    );
}

export type PaymentDetails = {
  totalCents: number | null;
  email: string | null;
  shipping: OrderShipping | null;
  paymentIntentId: string | null;
};

/** Conditional status move (no stock change), with what Stripe collected. */
function moveOrder(
  orderId: string,
  { to, from }: Pick<Transition, "to" | "from">,
  details: PaymentDetails,
) {
  return db
    .update(orders)
    .set({
      status: to,
      totalCents: details.totalCents,
      email: details.email,
      shipping: details.shipping,
      stripePaymentIntentId: details.paymentIntentId,
      ...(to === "paid" && { paidAt: new Date() }),
    })
    .where(and(eq(orders.id, orderId), inArray(orders.status, from)));
}

/** Applies a transition; stock is released only on `release` moves. */
export async function applyTransition(
  orderId: string,
  transition: Transition,
  details: PaymentDetails,
  event?: { id: string; type: string },
) {
  if (!transition.release) {
    const move = moveOrder(orderId, transition, details);
    if (!event) await move;
    else await db.batch([recordEvent(event), move]);
    return { released: false };
  }
  const release = releaseOrder(orderId, transition);
  const result = event
    ? (await db.batch([recordEvent(event), release]))[1]
    : await release;
  // Whether units came back (not when the order had already ended).
  return { released: result.rows.length > 0 };
}

/** Recorded in the same transaction as the event's effect. */
function recordEvent(event: { id: string; type: string }) {
  return db
    .insert(stripeEvents)
    .values({ id: event.id, type: event.type })
    .onConflictDoNothing();
}

export async function isEventProcessed(eventId: string) {
  const [row] = await db
    .select({ id: stripeEvents.id })
    .from(stripeEvents)
    .where(eq(stripeEvents.id, eventId))
    .limit(1);
  return Boolean(row);
}

/** What an order bought, as bag items (product id and quantity). */
export async function getOrderLines(orderId: string) {
  return db
    .select({ productId: orderItems.productId, quantity: orderItems.quantity })
    .from(orderItems)
    .where(eq(orderItems.orderId, orderId));
}

/** The order with its own status and owner, for server-side checks only. */
export async function getOrderRecord(orderId: string) {
  const [row] = await db
    .select({
      id: orders.id,
      userId: orders.userId,
      status: orders.status,
      subtotalCents: orders.subtotalCents,
      stripeCheckoutSessionId: orders.stripeCheckoutSessionId,
    })
    .from(orders)
    .where(eq(orders.id, orderId))
    .limit(1);
  return row;
}
