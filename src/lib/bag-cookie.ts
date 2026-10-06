import "server-only";

import { cookies } from "next/headers";

import { getBagProducts } from "@/db/queries";
import {
  BAG_COUNT_COOKIE,
  type BagItem,
  buildBag,
  parseBag,
  serializeBag,
  withoutOrdered,
} from "@/lib/bag";
import type { Product } from "@/types/catalog";

const BAG_COOKIE = "corvo_bag";

/** The stored bag, unchecked: run it through `buildBag` before trusting it. */
export async function readBag(): Promise<BagItem[]> {
  return parseBag((await cookies()).get(BAG_COOKIE)?.value);
}

/**
 * Stores the bag and its live item count (for the header). `products` must
 * include every product in `items`. Only callable from Server Actions and
 * Route Handlers.
 */
export async function writeBag(items: BagItem[], products: Product[]) {
  const store = await cookies();
  if (!items.length) {
    store.delete(BAG_COOKIE);
    store.delete(BAG_COUNT_COOKIE);
    return;
  }
  const options = {
    sameSite: "lax",
    secure: process.env.NODE_ENV === "production",
    path: "/",
    maxAge: 60 * 60 * 24 * 30, // 30 days
  } as const;
  store.set(BAG_COOKIE, serializeBag(items), { ...options, httpOnly: true });
  store.set(
    BAG_COUNT_COOKIE,
    String(buildBag(items, products).itemCount),
    options,
  );
}

/**
 * The stored bag checked against live products. `extraIds` are fetched too
 * (e.g. a product about to be added) and returned in `products`.
 */
export async function loadBag(extraIds: number[] = []) {
  const items = await readBag();
  const products = await getBagProducts([
    ...new Set([...items.map((i) => i.productId), ...extraIds]),
  ]);
  return { bag: buildBag(items, products), products };
}

/**
 * Takes a paid order's pieces out of the bag, keeping anything added since.
 * Returns whether the bag changed.
 */
export async function removeOrderedFromBag(ordered: BagItem[]) {
  const items = await readBag();
  const next = withoutOrdered(items, ordered);
  const changed =
    next.length !== items.length ||
    next.some((item, i) => item.quantity !== items[i].quantity);
  if (changed)
    await writeBag(next, await getBagProducts(next.map((i) => i.productId)));
  return changed;
}
