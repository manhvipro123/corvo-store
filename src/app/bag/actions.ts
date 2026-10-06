"use server";

import { refresh } from "next/cache";
import { redirect } from "next/navigation";

import { CheckoutInProgressError, OutOfStockError } from "@/db/orders";
import {
  MAX_BAG_LINES,
  MAX_LINE_QUANTITY,
  lineLimit,
  readPositiveInt,
} from "@/lib/bag";
import { loadBag, writeBag } from "@/lib/bag-cookie";
import { totalProblem } from "@/lib/checkout";
import {
  cancelPendingCheckout,
  clearConfirmedCheckout,
  createCheckout,
} from "@/lib/checkout-session";
import { requireUser } from "@/lib/session";

export type AddToBagState = { added?: boolean; message?: string };

/** Adds one of a product, never beyond its live stock or the line cap. */
export async function addToBag(
  _prev: AddToBagState,
  data: FormData,
): Promise<AddToBagState> {
  const productId = readPositiveInt(data.get("productId"));
  if (!productId) return { message: "Something went wrong. Please try again." };

  const { bag, products } = await loadBag([productId]);
  const product = products.find((p) => p.id === productId);
  if (!product) return { message: "This piece is no longer available." };
  if (product.stock <= 0) return { message: "This piece has just sold out." };

  const limit = lineLimit(product.stock);
  const current = bag.items.find((i) => i.productId === productId);
  const inBag = Math.min(current?.quantity ?? 0, limit);
  if (inBag + 1 > limit) {
    await writeBag(bag.items, products);
    return {
      message:
        product.stock > MAX_LINE_QUANTITY
          ? `You can buy up to ${limit} of this piece at a time.`
          : limit === 1
            ? "The last one is already in your bag."
            : `You already have all ${limit} available in your bag.`,
    };
  }
  if (!current && bag.items.length >= MAX_BAG_LINES)
    return { message: "Your bag is full. Remove a piece to add this one." };

  await writeBag(
    current
      ? bag.items.map((i) =>
          i.productId === productId ? { ...i, quantity: inBag + 1 } : i,
        )
      : [...bag.items, { productId, quantity: 1 }],
    products,
  );
  return { added: true };
}

/** Sets a line's quantity, limited to live stock and the line cap; 0 removes the line. */
export async function updateQuantity(data: FormData) {
  const productId = readPositiveInt(data.get("productId"));
  const quantity =
    data.get("quantity") === "0" ? 0 : readPositiveInt(data.get("quantity"));
  if (!productId || quantity === null) return;

  const { bag, products } = await loadBag();
  const line = bag.lines.find((l) => l.product.id === productId);
  if (!line) return;

  const next = Math.min(quantity, lineLimit(line.product.stock));
  await writeBag(
    next > 0
      ? bag.items.map((i) =>
          i.productId === productId ? { ...i, quantity: next } : i,
        )
      : bag.items.filter((i) => i.productId !== productId),
    products,
  );
  refresh();
}

export async function removeFromBag(data: FormData) {
  const productId = readPositiveInt(data.get("productId"));
  if (!productId) return;
  const { bag, products } = await loadBag();
  await writeBag(
    bag.items.filter((i) => i.productId !== productId),
    products,
  );
  refresh();
}

export type CheckoutState = { message?: string };

/**
 * Starts Stripe Checkout for the bag. Nothing comes from the form: lines and
 * prices are re-read from the DB, and stock is reserved before redirecting.
 */
export async function startCheckout(): Promise<CheckoutState> {
  const { user } = await requireUser("/bag");

  // The last checkout was paid but its success page never ran: don't
  // charge the same pieces twice.
  if (await clearConfirmedCheckout(user.id)) {
    refresh();
    return {
      message:
        "Your last order went through, so its pieces are out of your bag. Please review it.",
    };
  }

  // One pending checkout per user: end any earlier one first.
  let awaitingConfirmation: boolean;
  try {
    awaitingConfirmation = await cancelPendingCheckout(user.id);
  } catch (error) {
    console.error("[checkout] could not end the previous checkout", error);
    return { message: "We couldn't start checkout. Please try again." };
  }
  // Paid at Stripe, webhook not here yet: don't charge the bag twice.
  if (awaitingConfirmation)
    return {
      message:
        "Your last payment is still being confirmed. Please check your orders before checking out again.",
    };

  const { bag, products } = await loadBag();
  if (bag.adjustments.length) {
    await writeBag(bag.items, products);
    refresh();
    return {
      message: "Your bag changed. Please review it before checking out.",
    };
  }
  if (bag.lines.some((line) => line.quantity === 0))
    return { message: "Remove sold-out pieces before checking out." };
  if (!bag.lines.length) return { message: "Your bag is empty." };
  const problem = totalProblem(bag.subtotalCents);
  if (problem) return { message: problem };

  let url: string;
  try {
    url = await createCheckout(
      user,
      bag.lines.map(({ product, quantity }) => ({
        productId: product.id,
        name: product.name,
        sku: product.sku,
        imageUrl: product.image.src,
        unitPriceCents: product.priceCents,
        quantity,
      })),
    );
  } catch (error) {
    if (error instanceof OutOfStockError) {
      refresh();
      return {
        message:
          "Someone just bought one of these pieces. Please review your bag.",
      };
    }
    // Another checkout of this account started at the same moment (e.g. in
    // a second tab): only one of them may be paid.
    if (error instanceof CheckoutInProgressError)
      return {
        message:
          "Another checkout is already in progress. Please finish it or try again in a moment.",
      };
    console.error("[checkout] could not start checkout", error);
    return { message: "We couldn't start checkout. Please try again." };
  }
  // Outside try/catch: redirect() works by throwing.
  redirect(url);
}
