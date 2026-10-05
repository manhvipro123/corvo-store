/**
 * Checkout rules free of Next, Stripe's client and the DB, so they can be
 * unit tested. Amounts always come from our order snapshot; order status
 * only ever changes from verified Stripe data.
 */

import type Stripe from "stripe";

import type { OrderStatus } from "@/types/catalog";

/** Stock is held this long; also the Checkout Session lifetime (Stripe's minimum). */
export const RESERVATION_MINUTES = 30;

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

export const subtotalOf = (lines: ReservedLine[]) =>
  lines.reduce((sum, l) => sum + l.unitPriceCents * l.quantity, 0);

/**
 * How a Checkout Session event moves an order. `from` lists the states the
 * move is allowed from, so replays and out-of-order events are no-ops;
 * `release` returns the reserved stock.
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
      return { to: "paid", from: ["processing"], release: false };
    case "checkout.session.async_payment_failed":
      return { to: "failed", from: ["processing"], release: true };
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
