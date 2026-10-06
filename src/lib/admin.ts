import { HISTORY_STATUSES } from "@/lib/orders";
import type { AdminOrderFilter } from "@/types/admin";
import type { OrderStatus } from "@/types/catalog";

/**
 * URL state for admin listings. Like the catalog, filters live only in the
 * query string and controls are links.
 */

type SearchParams = Record<string, string | string[] | undefined>;

export const firstParam = (params: SearchParams, key: string) => {
  const value = params[key];
  return Array.isArray(value) ? value[0] : value;
};

/** `path` with the non-empty `params`, in the order given. */
export function adminHref(
  path: string,
  params: Record<string, string | number | undefined> = {},
) {
  const search = new URLSearchParams();
  for (const [key, value] of Object.entries(params))
    if (value !== undefined && value !== "") search.set(key, String(value));
  const query = search.toString();
  return query ? `${path}?${query}` : path;
}

/** A route `[id]` that must be a database id; undefined for anything else. */
export function parseRouteId(value: string) {
  if (!/^[1-9]\d{0,9}$/.test(value)) return undefined;
  const id = Number(value);
  return id <= 2 ** 31 - 1 ? id : undefined;
}

/** 1-based page number from `?page=`; 1 when missing or invalid. */
export function parsePage(value: string | undefined) {
  const page = Number(value);
  return Number.isInteger(page) && page >= 1 && page <= 10_000 ? page : 1;
}

export const inventoryFilters = [
  { value: undefined, label: "All" },
  { value: "low-stock", label: "Low stock" },
  { value: "sold-out", label: "Sold out" },
] as const;

export type InventoryFilter = (typeof inventoryFilters)[number]["value"];

export function parseInventoryFilter(
  value: string | undefined,
): InventoryFilter {
  return inventoryFilters.find((f) => f.value && f.value === value)?.value;
}

/**
 * Order tabs. "Placed" (the default) is what customers see in their history;
 * pending and expired checkouts are listed separately since they were never
 * paid. "Needs reconcile" are the pending ones Stripe reported complete
 * whose webhook never came: their events must be resent from Stripe.
 */
export const orderFilters: { value: AdminOrderFilter; label: string }[] = [
  { value: "placed", label: "Placed" },
  { value: "paid", label: "Paid" },
  { value: "processing", label: "Processing" },
  { value: "failed", label: "Failed" },
  { value: "pending", label: "Awaiting payment" },
  { value: "reconcile", label: "Needs reconcile" },
  { value: "expired", label: "Checkout ended" },
  { value: "all", label: "All" },
];

export function parseOrderFilter(value: string | undefined): AdminOrderFilter {
  return orderFilters.find((f) => f.value === value)?.value ?? "placed";
}

/** Statuses a filter covers; undefined means every status. */
export function orderFilterStatuses(
  filter: AdminOrderFilter,
): readonly OrderStatus[] | undefined {
  if (filter === "all") return undefined;
  if (filter === "placed") return HISTORY_STATUSES;
  if (filter === "reconcile") return ["pending"];
  return [filter];
}
