import { colors } from "@/lib/colors";
import type { CategorySlug, ColorSlug } from "@/types/catalog";

export const sortOptions = [
  { value: "recommended", label: "Recommended" },
  { value: "newest", label: "Newest" },
  { value: "price-asc", label: "Price: low to high" },
  { value: "price-desc", label: "Price: high to low" },
] as const;

export type SortValue = (typeof sortOptions)[number]["value"];

export type CatalogFilters = {
  category?: CategorySlug;
  colors: ColorSlug[];
  /**
   * The default sort. With a search `query` it means "by relevance", so it
   * is labelled that way (see `sortLabel`).
   */
  sort: SortValue;
  /** Search text (already normalised). Set only on /search. */
  query?: string;
};

export const defaultFilters: CatalogFilters = {
  colors: [],
  sort: "recommended",
};

type SearchParams = Record<string, string | string[] | undefined>;

const first = (value: string | string[] | undefined) =>
  Array.isArray(value) ? value[0] : value;

/**
 * Parses URL params, silently dropping unknown values. `categorySlugs` is
 * the list of valid categories (from the database).
 */
export function parseFilters(
  params: SearchParams,
  categorySlugs: readonly CategorySlug[],
): CatalogFilters {
  const categoryParam = first(params.category);
  const category = categorySlugs.find((slug) => slug === categoryParam);
  const colorParam = first(params.color)?.split(",") ?? [];
  const sort =
    sortOptions.find((o) => o.value === first(params.sort))?.value ??
    "recommended";

  return {
    category,
    colors: colors.map((c) => c.slug).filter((c) => colorParam.includes(c)),
    sort,
  };
}

/**
 * URL for the listing with `patch` applied; defaults are left out of the
 * query. With a search query the URL stays on /search and keeps `q`.
 */
export function filtersHref(
  filters: CatalogFilters,
  patch: Partial<CatalogFilters> = {},
) {
  const next = { ...filters, ...patch };
  const params = new URLSearchParams();
  if (next.query) params.set("q", next.query);
  if (next.category) params.set("category", next.category);
  if (next.colors.length) params.set("color", next.colors.join(","));
  if (next.sort !== "recommended") params.set("sort", next.sort);
  const path = next.query ? "/search" : "/products";
  const search = params.toString();
  return search ? `${path}?${search}` : path;
}

/** Display label for a sort; the default reads "Relevance" when searching. */
export function sortLabel(filters: CatalogFilters) {
  if (filters.query && filters.sort === "recommended") return "Relevance";
  return sortOptions.find((o) => o.value === filters.sort)?.label ?? "";
}

/** Listing URL for a single category with no other filters. */
export function categoryHref(category: CategorySlug) {
  return filtersHref(defaultFilters, { category });
}

export function toggleColor(filters: CatalogFilters, color: ColorSlug) {
  return filters.colors.includes(color)
    ? filters.colors.filter((c) => c !== color)
    : [...filters.colors, color];
}

/** Below this many units the page shows "Only N left". */
const LOW_STOCK_THRESHOLD = 3;

export type StockStatus = "in-stock" | "low-stock" | "sold-out";

export function getStockStatus(stock: number): StockStatus {
  if (stock <= 0) return "sold-out";
  if (stock <= LOW_STOCK_THRESHOLD) return "low-stock";
  return "in-stock";
}
