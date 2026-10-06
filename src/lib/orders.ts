import type { OrderStatus } from "@/types/catalog";

/**
 * Statuses shown in order history. `pending` and `expired` are checkout
 * attempts that were never paid, not orders the customer placed.
 */
export const HISTORY_STATUSES = [
  "paid",
  "processing",
  "failed",
] as const satisfies OrderStatus[];

export const isHistoryStatus = (status: OrderStatus) =>
  (HISTORY_STATUSES as readonly OrderStatus[]).includes(status);

/** Short, customer-facing order number: the first 8 characters of the id. */
export const orderNumber = (id: string) => id.slice(0, 8).toUpperCase();

export const orderStatusLabel: Record<OrderStatus, string> = {
  paid: "Paid",
  processing: "Payment processing",
  failed: "Payment failed",
  pending: "Awaiting payment",
  expired: "Checkout ended",
};

/** What the current status means for the customer, on the order page. */
export const orderStatusNote: Record<OrderStatus, string> = {
  paid: "Payment received. We're preparing your pieces.",
  processing:
    "Your payment is still clearing. We'll confirm the order as soon as it does.",
  failed:
    "The payment didn't go through, so the order was cancelled and you weren't charged.",
  pending: "We're waiting for your payment to be confirmed.",
  expired: "This checkout ended before payment. You weren't charged.",
};

/** Order ids are server-generated UUIDs; anything else can't be an order. */
export const isOrderId = (value: string) =>
  /^[0-9a-f]{8}-[0-9a-f]{4}-[0-9a-f]{4}-[0-9a-f]{4}-[0-9a-f]{12}$/.test(value);
