/**
 * Shopping bag rules, free of Next and the DB so they can be unit tested.
 * The bag cookie stores only product ids and quantities; prices and stock
 * always come from the database and are re-checked on every read.
 */

import type { Product } from "@/types/catalog";

export type BagItem = { productId: number; quantity: number };

/**
 * Companion cookie with just the item count, readable by client JS so the
 * header can show it without reading the bag on the server.
 */
export const BAG_COUNT_COOKIE = "corvo_bag_count";

/** Keeps the cookie well under the ~4 KB browser limit. */
export const MAX_BAG_LINES = 50;

const isPositiveInt = (n: number) => Number.isSafeInteger(n) && n > 0;

/**
 * Parses the cookie value ("12:1.40:2"). Malformed entries are dropped, a
 * repeated id keeps its first quantity, and only the first
 * `MAX_BAG_LINES` lines are kept.
 */
export function parseBag(value: string | undefined): BagItem[] {
  const items: BagItem[] = [];
  const seen = new Set<number>();
  for (const entry of (value ?? "").split(".")) {
    const match = /^(\d+):(\d+)$/.exec(entry);
    if (!match) continue;
    const productId = Number(match[1]);
    const quantity = Number(match[2]);
    if (!isPositiveInt(productId) || !isPositiveInt(quantity)) continue;
    if (seen.has(productId)) continue;
    seen.add(productId);
    items.push({ productId, quantity });
    if (items.length === MAX_BAG_LINES) break;
  }
  return items;
}

export function serializeBag(items: BagItem[]): string {
  return items
    .slice(0, MAX_BAG_LINES)
    .map((i) => `${i.productId}:${i.quantity}`)
    .join(".");
}

/** Reads a positive integer form field (product id, quantity), else null. */
export function readPositiveInt(value: FormDataEntryValue | null) {
  if (typeof value !== "string" || !/^\d+$/.test(value)) return null;
  const n = Number(value);
  return isPositiveInt(n) ? n : null;
}

export type BagLine = {
  product: Product;
  /** Already limited to what's in stock (0 when sold out). */
  quantity: number;
  /** Line total in cents; 0 when sold out. */
  totalCents: number;
};

export type Bag = {
  lines: BagLine[];
  /** What changed against the stored bag, for the customer to read. */
  adjustments: string[];
  /** Normalised items to store back in the cookie. */
  items: BagItem[];
  subtotalCents: number;
  itemCount: number;
};

/**
 * Joins stored items with live products: drops removed products, keeps
 * sold-out ones (shown, not charged) and lowers quantities above stock.
 */
export function buildBag(items: BagItem[], products: Product[]): Bag {
  const byId = new Map(products.map((p) => [p.id, p]));
  const lines: BagLine[] = [];
  const adjustments: string[] = [];
  const kept: BagItem[] = [];

  for (const item of items) {
    const product = byId.get(item.productId);
    if (!product) {
      adjustments.push(
        "An item in your bag is no longer available and was removed.",
      );
      continue;
    }
    const stock = Math.max(0, product.stock);
    const quantity = Math.min(item.quantity, stock);
    if (stock > 0 && quantity < item.quantity)
      adjustments.push(
        `Only ${stock} of ${product.name} left; we've updated your bag.`,
      );
    lines.push({
      product,
      quantity,
      totalCents: quantity * product.priceCents,
    });
    // Sold-out lines keep their old quantity in the cookie, so they come
    // back if restocked; they're never charged meanwhile.
    kept.push({
      productId: item.productId,
      quantity: quantity || item.quantity,
    });
  }

  return {
    lines,
    adjustments,
    items: kept,
    subtotalCents: lines.reduce((sum, line) => sum + line.totalCents, 0),
    itemCount: lines.reduce((sum, line) => sum + line.quantity, 0),
  };
}
