import { describe, expect, it } from "vitest";

import { productColor } from "@/db/schema";
import {
  categoryHref,
  defaultFilters,
  filtersHref,
  getStockStatus,
  parseFilters,
  sortLabel,
  toggleColor,
} from "@/lib/catalog";
import { colors } from "@/lib/colors";
import { formatPrice } from "@/lib/format";

const categories = ["ready-to-wear", "bags", "shoes"];

describe("parseFilters", () => {
  it("returns defaults for empty params", () => {
    expect(parseFilters({}, categories)).toEqual(defaultFilters);
  });

  it("accepts known values", () => {
    expect(
      parseFilters(
        { category: "bags", color: "black,gold", sort: "price-asc" },
        categories,
      ),
    ).toEqual({
      category: "bags",
      colors: ["black", "gold"],
      sort: "price-asc",
    });
  });

  it("drops unknown category, colours and sort", () => {
    expect(
      parseFilters(
        { category: "hats", color: "black,purple", sort: "random" },
        categories,
      ),
    ).toEqual({ category: undefined, colors: ["black"], sort: "recommended" });
  });

  it("uses the first value of repeated params", () => {
    expect(
      parseFilters({ category: ["shoes", "bags"] }, categories).category,
    ).toBe("shoes");
  });
});

describe("filtersHref", () => {
  it("omits defaults from the query", () => {
    expect(filtersHref(defaultFilters)).toBe("/products");
  });

  it("serialises category, colours and sort", () => {
    expect(
      filtersHref(defaultFilters, {
        category: "bags",
        colors: ["black", "gold"],
        sort: "newest",
      }),
    ).toBe("/products?category=bags&color=black%2Cgold&sort=newest");
  });

  it("builds a category-only link", () => {
    expect(categoryHref("shoes")).toBe("/products?category=shoes");
  });
});

describe("search-aware filters", () => {
  const searching = { ...defaultFilters, query: "black bag" };

  it("keeps the query and stays on /search", () => {
    expect(filtersHref(searching, { category: "bags" })).toBe(
      "/search?q=black+bag&category=bags",
    );
  });

  it("labels the default sort as relevance only when searching", () => {
    expect(sortLabel(searching)).toBe("Relevance");
    expect(sortLabel(defaultFilters)).toBe("Recommended");
    expect(sortLabel({ ...searching, sort: "price-asc" })).toBe(
      "Price: low to high",
    );
  });
});

describe("toggleColor", () => {
  it("adds and removes a colour", () => {
    const filters = { ...defaultFilters, colors: ["black" as const] };
    expect(toggleColor(filters, "gold")).toEqual(["black", "gold"]);
    expect(toggleColor(filters, "black")).toEqual([]);
  });
});

describe("getStockStatus", () => {
  it.each([
    [0, "sold-out"],
    [-1, "sold-out"],
    [1, "low-stock"],
    [3, "low-stock"],
    [4, "in-stock"],
  ] as const)("%i units → %s", (stock, status) => {
    expect(getStockStatus(stock)).toBe(status);
  });
});

describe("formatPrice", () => {
  it("formats whole-dollar cents without decimals", () => {
    expect(formatPrice(265000)).toBe("$2,650");
  });

  it("keeps cents when present", () => {
    expect(formatPrice(1250)).toBe("$12.50");
  });
});

describe("colours", () => {
  it("match the product_color enum in the database schema", () => {
    expect(colors.map((c) => c.slug)).toEqual(productColor.enumValues);
  });
});
