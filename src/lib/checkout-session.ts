import "server-only";

import { cookies } from "next/headers";
import type Stripe from "stripe";

import {
  applyTransition,
  attachCheckoutSession,
  getOrderLines,
  getOrderRecord,
  getPendingOrdersForUser,
  getStalePendingOrders,
  markReconcileNeeded,
  markSweepAttempted,
  releaseOrder,
  reserveOrder,
} from "@/db/orders";
import { removeOrderedFromBag } from "@/lib/bag-cookie";
import {
  amountMatches,
  type ReservedLine,
  staleCutoff,
  type Transition,
  toLineItems,
} from "@/lib/checkout";
import { revalidateStorefront } from "@/lib/storefront-cache";
import { siteURL, stripe } from "@/lib/stripe";

const EXPIRE = { to: "expired", from: ["pending"] } satisfies Pick<
  Transition,
  "to" | "from"
>;

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
    const released = await releaseOrder(order.id, EXPIRE);
    if (released.rows.length) revalidateStorefront();
    throw error;
  }

  if (!(await attachCheckoutSession(order.id, session.id))) {
    // Ended (and its stock released) while Stripe created the session:
    // never send the customer to pay for it.
    await stripe.checkout.sessions.expire(session.id).catch(() => {});
    throw new Error(`Order ${order.id} ended before its session was attached`);
  }
  await rememberCheckout(order.id);
  return session.url!;
}

/** Remembers the browser's checkout, so a paid one leaves the bag. */
async function rememberCheckout(orderId: string) {
  (await cookies()).set(CHECKOUT_COOKIE, orderId, {
    httpOnly: true,
    sameSite: "lax",
    secure: process.env.NODE_ENV === "production",
    path: "/",
    maxAge: 60 * 60 * 24, // longer than any session can live
  });
}

/**
 * Applies a verified webhook event's Checkout Session to its order. The only
 * code path that confirms a payment; nothing from the browser or its
 * redirects reaches it. Refreshes the storefront only if units came back.
 * Returns the order's status afterwards.
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

  if (!transition.release && !amountMatches(session, order.subtotalCents)) {
    // Never happens unless something upstream is wrong; don't mark it paid
    // or processing (an async payment would charge `amount_total` too).
    console.error("[checkout] amount mismatch", order.id, session.amount_total);
    return order.status;
  }

  const shipping = session.collected_information?.shipping_details;
  const { released } = await applyTransition(
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
  // Units came back: cached product pages show them on the next visit.
  if (released) revalidateStorefront();
  return (await getOrderRecord(order.id))?.status;
}

/** Stripe's "No such checkout.session": unknown to the account we use. */
function isMissingSession(error: unknown) {
  return (error as { code?: string } | null)?.code === "resource_missing";
}

/**
 * Releases a pending order's stock, but only once Stripe confirms its
 * session expired (expiring it first if still open), or that our account
 * has no such session (e.g. a test-mode session after switching to live
 * keys): neither can ever be paid here. A session completed in the meantime
 * is left alone: only the webhook marks orders paid. Returns what happened:
 * `released` here, `completed` at Stripe (waiting for its webhook), or
 * `skipped` (still open, or released elsewhere first). Other Stripe errors
 * throw, so the order is retried later.
 */
async function expireAndRelease(order: {
  id: string;
  stripeCheckoutSessionId: string | null;
}): Promise<"released" | "completed" | "skipped"> {
  let released;
  if (!order.stripeCheckoutSessionId) {
    released = await releaseOrder(order.id, EXPIRE);
  } else {
    try {
      await stripe.checkout.sessions.expire(order.stripeCheckoutSessionId);
    } catch {
      // Already expired or completed; the retrieve below tells which.
    }
    let session: Stripe.Checkout.Session | undefined;
    try {
      session = await stripe.checkout.sessions.retrieve(
        order.stripeCheckoutSessionId,
      );
    } catch (error) {
      if (!isMissingSession(error)) throw error;
      console.error(
        "[checkout] releasing an order whose session Stripe doesn't know",
        order.id,
        order.stripeCheckoutSessionId,
      );
    }
    if (session?.status === "complete") return "completed";
    // The `checkout.session.expired` webhook does the same; releasing is
    // idempotent, so whichever runs first wins.
    if (session && session.status !== "expired") return "skipped";
    released = await releaseOrder(order.id, EXPIRE);
  }
  if (!released.rows.length) return "skipped";
  revalidateStorefront();
  return "released";
}

/**
 * Ends every pending checkout of `userId`, found in the DB rather than via
 * this browser's cookie, so dropping the cookie or switching browsers can't
 * stack up held stock. Stock is released only once Stripe confirms the
 * session expired. A session paid in the meantime is left for the webhook
 * and remembered in this browser, so its pieces leave the bag once it's
 * confirmed; returns true then, and the caller must not start another
 * checkout for the same bag. Orders the sweep flagged are such sessions
 * already (Stripe reported them complete), so they count without asking
 * Stripe again.
 */
export async function cancelPendingCheckout(userId: string) {
  (await cookies()).delete(CHECKOUT_COOKIE);
  let awaitingConfirmation = false;
  for (const order of await getPendingOrdersForUser(userId)) {
    if (
      !order.reconcileNeeded &&
      (await expireAndRelease(order)) !== "completed"
    )
      continue;
    awaitingConfirmation = true;
    await rememberCheckout(order.id);
  }
  return awaitingConfirmation;
}

/**
 * Releases the stock of checkouts that ended without their `expired`
 * webhook (missed delivery, misconfigured endpoint, a session never
 * attached). Same rule as everywhere: release only once Stripe confirms
 * the session expired. A session Stripe reports complete lost its
 * `completed` webhook instead: it's flagged for the admin (resend the
 * event) and skipped by later runs, so it can't block the queue. Run by
 * the cron route and the admin inventory page.
 */
export async function releaseStalePendingOrders({ limit = 50 } = {}) {
  const stale = await getStalePendingOrders(staleCutoff(), limit);
  // Before trying them: one that fails now goes behind the untried ones.
  await markSweepAttempted(stale.map((order) => order.id));
  let released = 0;
  let needsReconcile = 0;
  for (const order of stale) {
    try {
      const outcome = await expireAndRelease(order);
      if (outcome === "released") released += 1;
      if (outcome === "completed") {
        console.error(
          "[checkout] session completed without its webhook",
          order.id,
          order.stripeCheckoutSessionId,
        );
        await markReconcileNeeded(order.id);
        needsReconcile += 1;
      }
    } catch (error) {
      // One bad order (e.g. Stripe unreachable) mustn't stop the rest.
      console.error("[checkout] stale release failed", order.id, error);
    }
  }
  return {
    released,
    needsReconcile,
    skipped: stale.length - released - needsReconcile,
  };
}

/**
 * Once the webhook has confirmed this browser's checkout (paid, or a delayed
 * payment processing), take its pieces out of the bag and forget the order.
 * Run by the success page, and again when the next checkout starts in case
 * the customer never came back to it. Reads only our DB. Returns whether
 * the bag changed.
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
  return removeOrderedFromBag(await getOrderLines(order.id));
}
