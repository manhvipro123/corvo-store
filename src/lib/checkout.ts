/**
 * Checkout rules free of Next, Stripe's client and the DB, so they can be
 * unit tested. Amounts always come from our order snapshot; order status
 * only ever changes from verified Stripe data.
 */

import type Stripe from "stripe";

import type { OrderStatus } from "@/types/catalog";

/** Stock is held this long; also the Checkout Session lifetime (Stripe's minimum). */
export const RESERVATION_MINUTES = 30;

/**
 * Added to the hold so `expires_at` is still at least 30 minutes ahead when
 * Stripe creates the session, after our DB round-trip and second flooring.
 */
export const RESERVATION_HEADROOM_MS = 60_000;

/** Grace after `expires_at` for Stripe's own `expired` webhook to arrive. */
export const STALE_GRACE_MINUTES = 5;

/**
 * Pending orders that expired before this are left to the sweep. The sweep
 * and the admin's "expired checkouts" count share it so they agree.
 */
export const staleCutoff = (now = Date.now()) =>
  new Date(now - STALE_GRACE_MINUTES * 60_000);

export type ReservedLine = {
  productId: number;
  name: string;
  sku: string;
  imageUrl: string;
  unitPriceCents: number;
  quantity: number;
};

/** Stripe line items built only from our server-side snapshot. */
export function toLineItems(
  lines: ReservedLine[],
): Stripe.Checkout.SessionCreateParams.LineItem[] {
  return lines.map((line) => ({
    quantity: line.quantity,
    price_data: {
      currency: "usd",
      unit_amount: line.unitPriceCents,
      product_data: {
        name: line.name,
        images: [line.imageUrl],
        metadata: { product_id: String(line.productId), sku: line.sku },
      },
    },
  }));
}

/** Stripe's smallest and largest USD charge, in cents. */
export const STRIPE_MIN_TOTAL_CENTS = 50;
export const STRIPE_MAX_TOTAL_CENTS = 99_999_999;

/**
 * Why Stripe would refuse to charge this subtotal, as a message for the
 * customer, or null. Checked before reserving, so nothing is held for a
 * checkout that can't start (the cap also keeps `subtotal_cents` in int4).
 */
export function totalProblem(subtotalCents: number): string | null {
  if (subtotalCents < STRIPE_MIN_TOTAL_CENTS)
    return "Your order total is below our minimum of $0.50.";
  if (subtotalCents > STRIPE_MAX_TOTAL_CENTS)
    return "Your order is too large to pay in one checkout. Please remove some pieces.";
  return null;
}

export const subtotalOf = (lines: ReservedLine[]) =>
  lines.reduce((sum, l) => sum + l.unitPriceCents * l.quantity, 0);

/**
 * How a Checkout Session event moves an order. `from` lists the states the
 * move is allowed from, so replays and stale events are no-ops; `release`
 * returns the reserved stock. Stripe doesn't guarantee delivery order, and
 * a handled event is never applied again, so the async outcome also applies
 * to a still-`pending` order whose `completed` event hasn't arrived yet
 * (that late `completed` is then a no-op).
 */
export type Transition = {
  to: OrderStatus;
  from: OrderStatus[];
  release: boolean;
};

export function transitionFor(
  eventType: string,
  paymentStatus: Stripe.Checkout.Session.PaymentStatus,
): Transition | null {
  switch (eventType) {
    case "checkout.session.completed":
      return paymentStatus === "unpaid"
        ? { to: "processing", from: ["pending"], release: false }
        : { to: "paid", from: ["pending"], release: false };
    case "checkout.session.async_payment_succeeded":
      return { to: "paid", from: ["pending", "processing"], release: false };
    case "checkout.session.async_payment_failed":
      return { to: "failed", from: ["pending", "processing"], release: true };
    case "checkout.session.expired":
      return { to: "expired", from: ["pending"], release: true };
    default:
      return null;
  }
}

/** Stripe must have charged exactly our snapshot total, in USD. */
export function amountMatches(
  session: Pick<Stripe.Checkout.Session, "amount_total" | "currency">,
  subtotalCents: number,
) {
  return session.amount_total === subtotalCents && session.currency === "usd";
}
