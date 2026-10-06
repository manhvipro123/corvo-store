"use server";

import { refresh } from "next/cache";
import { redirect } from "next/navigation";

import { OutOfStockError } from "@/db/orders";
import { MAX_BAG_LINES, readPositiveInt } from "@/lib/bag";
import { loadBag, writeBag } from "@/lib/bag-cookie";
import { cancelPendingCheckout, createCheckout } from "@/lib/checkout-session";
import { requireUser } from "@/lib/session";

export type AddToBagState = { added?: boolean; message?: string };

/** Adds one of a product, never beyond its live stock. */
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

  const current = bag.items.find((i) => i.productId === productId);
  const inBag = Math.min(current?.quantity ?? 0, product.stock);
  if (inBag + 1 > product.stock) {
    await writeBag(bag.items, products);
    return {
      message:
        product.stock === 1
          ? "The last one is already in your bag."
          : `You already have all ${product.stock} available in your bag.`,
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

/** Sets a line's quantity, limited to live stock; 0 removes the line. */
export async function updateQuantity(data: FormData) {
  const productId = readPositiveInt(data.get("productId"));
  const quantity =
    data.get("quantity") === "0" ? 0 : readPositiveInt(data.get("quantity"));
  if (!productId || quantity === null) return;

  const { bag, products } = await loadBag();
  const line = bag.lines.find((l) => l.product.id === productId);
  if (!line) return;

  const next = Math.min(quantity, line.product.stock);
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

  // One pending checkout per browser: end the previous one first.
  await cancelPendingCheckout(user.id);

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
    console.error("[checkout] could not start checkout", error);
    return { message: "We couldn't start checkout. Please try again." };
  }
  // Outside try/catch: redirect() works by throwing.
  redirect(url);
}
