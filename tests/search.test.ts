import { describe, expect, it } from "vitest";

import { escapeLike, normalizeQuery, searchTerms } from "@/lib/search";

describe("normalizeQuery", () => {
  it("trims and collapses whitespace", () => {
    expect(normalizeQuery("  leather   bag ")).toBe("leather bag");
  });

  it("handles missing and repeated params", () => {
    expect(normalizeQuery(undefined)).toBe("");
    expect(normalizeQuery(["coat", "bag"])).toBe("coat");
  });

  it("caps the length", () => {
    expect(normalizeQuery("a".repeat(500))).toHaveLength(100);
  });
});

describe("searchTerms", () => {
  it("lower-cases, de-duplicates and caps terms", () => {
    expect(searchTerms("Bag bag LEATHER")).toEqual(["bag", "leather"]);
    expect(searchTerms("a b c d e f g")).toHaveLength(5);
    expect(searchTerms("")).toEqual([]);
  });
});

describe("escapeLike", () => {
  it("escapes LIKE wildcards and backslashes", () => {
    expect(escapeLike("100%_\\")).toBe("100\\%\\_\\\\");
  });
});
