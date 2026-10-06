import "server-only";

import { cookies } from "next/headers";
import type Stripe from "stripe";

import {
  applyTransition,
  attachCheckoutSession,
  getOrderRecord,
  getStalePendingOrders,
  releaseOrder,
  reserveOrder,
} from "@/db/orders";
import { clearBag } from "@/lib/bag-cookie";
import {
  amountMatches,
  type ReservedLine,
  type Transition,
  toLineItems,
} from "@/lib/checkout";
import { revalidateStorefront } from "@/lib/storefront-cache";
import { siteURL, stripe } from "@/lib/stripe";

/** httpOnly cookie with the browser's pending order id (one at a time). */
const CHECKOUT_COOKIE = "corvo_checkout";

/**
 * Reserves stock, creates the order and its Stripe Checkout Session, and
 * remembers the order in this browser. Prices come only from `lines`, which
 * the caller builds from live DB products. Throws `OutOfStockError`.
 */
export async function createCheckout(
  user: { id: string; email: string },
  lines: ReservedLine[],
) {
  const order = await reserveOrder({ userId: user.id, lines });

  let session: Stripe.Checkout.Session;
  try {
    session = await stripe.checkout.sessions.create(
      {
        mode: "payment",
        line_items: toLineItems(lines),
        client_reference_id: order.id,
        metadata: { order_id: order.id },
        customer_email: user.email,
        shipping_address_collection: { allowed_countries: ["US"] },
        // We sell physical goods and ship them ourselves; Managed Payments
        // (Stripe as merchant of record, on by default for new accounts)
        // doesn't allow collecting a shipping address.
        managed_payments: { enabled: false },
        expires_at: Math.floor(order.expiresAt.getTime() / 1000),
        // The success page only reads the order; the webhook confirms payment.
        success_url: `${siteURL()}/checkout/success?session_id={CHECKOUT_SESSION_ID}`,
        cancel_url: `${siteURL()}/checkout/cancelled`,
        integration_identifier: "corvo-bag-checkout-qkvrmzta",
      },
      // A retried create returns the same session instead of a second one.
      { idempotencyKey: order.id },
    );
  } catch (error) {
    await releaseOrder(order.id, { to: "expired", from: ["pending"] });
    throw error;
  }

  await attachCheckoutSession(order.id, session.id);
  (await cookies()).set(CHECKOUT_COOKIE, order.id, {
    httpOnly: true,
    sameSite: "lax",
    secure: process.env.NODE_ENV === "production",
    path: "/",
    maxAge: 60 * 60 * 24, // longer than any session can live
  });
  return session.url!;
}

/**
 * Applies a verified webhook event's Checkout Session to its order. The only
 * code path that confirms a payment; nothing from the browser or its
 * redirects reaches it. Returns the order's status afterwards.
 */
export async function syncCheckoutSession(
  session: Stripe.Checkout.Session,
  transition: Transition,
  event: { id: string; type: string },
) {
  const orderId = session.client_reference_id;
  const order = orderId ? await getOrderRecord(orderId) : undefined;
  if (!order || order.stripeCheckoutSessionId !== session.id) {
    console.error("[checkout] session without a matching order", session.id);
    return undefined;
  }

  if (
    !transition.release &&
    session.payment_status !== "unpaid" &&
    !amountMatches(session, order.subtotalCents)
  ) {
    // Never happens unless something upstream is wrong; don't mark it paid.
    console.error("[checkout] amount mismatch", order.id, session.amount_total);
    return order.status;
  }

  const shipping = session.collected_information?.shipping_details;
  await applyTransition(
    order.id,
    transition,
    {
      totalCents: session.amount_total,
      email: session.customer_details?.email ?? null,
      shipping: shipping
        ? { name: shipping.name, address: shipping.address }
        : null,
      paymentIntentId:
        typeof session.payment_intent === "string"
          ? session.payment_intent
          : (session.payment_intent?.id ?? null),
    },
    event,
  );
  return (await getOrderRecord(order.id))?.status;
}

const EXPIRE = { to: "expired", from: ["pending"] } satisfies Pick<
  Transition,
  "to" | "from"
>;

/**
 * Releases a pending order's stock, but only once Stripe confirms its
 * session expired (expiring it first if still open). A session completed in
 * the meantime is left alone: only the webhook marks orders paid. Returns
 * whether stock was released here.
 */
async function expireAndRelease(order: {
  id: string;
  stripeCheckoutSessionId: string | null;
}) {
  let released;
  if (!order.stripeCheckoutSessionId) {
    released = await releaseOrder(order.id, EXPIRE);
  } else {
    try {
      await stripe.checkout.sessions.expire(order.stripeCheckoutSessionId);
    } catch {
      // Already expired or completed; the retrieve below tells which.
    }
    const session = await stripe.checkout.sessions.retrieve(
      order.stripeCheckoutSessionId,
    );
    // The `checkout.session.expired` webhook does the same; releasing is
    // idempotent, so whichever runs first wins.
    if (session.status !== "expired") return false;
    released = await releaseOrder(order.id, EXPIRE);
  }
  if (!released.rows.length) return false;
  revalidateStorefront();
  return true;
}

/**
 * Ends this browser's pending checkout, if it belongs to `userId`. Stock is
 * released only once Stripe confirms the session expired; if it was paid in
 * the meantime nothing changes here and the webhook marks it paid.
 */
export async function cancelPendingCheckout(userId: string) {
  const store = await cookies();
  const orderId = store.get(CHECKOUT_COOKIE)?.value;
  if (!orderId) return;
  store.delete(CHECKOUT_COOKIE);

  const order = await getOrderRecord(orderId);
  if (!order || order.userId !== userId || order.status !== "pending") return;
  await expireAndRelease(order);
}

/** Grace after `expires_at` for Stripe's own `expired` webhook to arrive. */
const STALE_GRACE_MINUTES = 5;

/**
 * Releases the stock of checkouts that ended without their `expired`
 * webhook (missed delivery, misconfigured endpoint, a session never
 * attached). Same rule as everywhere: release only once Stripe confirms
 * the session expired. Run by the cron route and the admin inventory page.
 */
export async function releaseStalePendingOrders({ limit = 50 } = {}) {
  const before = new Date(Date.now() - STALE_GRACE_MINUTES * 60_000);
  const stale = await getStalePendingOrders(before, limit);
  let released = 0;
  for (const order of stale) {
    try {
      if (await expireAndRelease(order)) released += 1;
    } catch (error) {
      // One bad order (e.g. Stripe unreachable) mustn't stop the rest.
      console.error("[checkout] stale release failed", order.id, error);
    }
  }
  return { released, skipped: stale.length - released };
}

/**
 * Once the webhook has confirmed this browser's checkout (paid, or a delayed
 * payment processing), empty the bag and forget the order. Reads only our DB.
 */
export async function clearConfirmedCheckout(userId: string) {
  const store = await cookies();
  const orderId = store.get(CHECKOUT_COOKIE)?.value;
  if (!orderId) return false;
  const order = await getOrderRecord(orderId);
  if (
    !order ||
    order.userId !== userId ||
    (order.status !== "paid" && order.status !== "processing")
  )
    return false;
  store.delete(CHECKOUT_COOKIE);
  await clearBag();
  return true;
}
