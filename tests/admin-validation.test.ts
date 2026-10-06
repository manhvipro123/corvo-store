import { describe, expect, it } from "vitest";

import {
  STOCK_MAX,
  isAllowedImageUrl,
  parseCategoryForm,
  parsePriceCents,
  parseProductForm,
  parseStockAdjustForm,
  parseStockForm,
  priceInputValue,
  slugify,
} from "@/lib/admin-validation";
import {
  adminHref,
  orderFilterStatuses,
  parseOrderFilter,
  parsePage,
  parseRouteId,
} from "@/lib/admin";

const form = (values: Record<string, string>) => {
  const data = new FormData();
  for (const [key, value] of Object.entries(values)) data.set(key, value);
  return data;
};

const validProduct = {
  name: " Silk Scarf ",
  slug: "silk-scarf-ivory",
  sku: "cv-ac-2001",
  categoryId: "4",
  color: "white",
  price: "1,250.5",
  description: "A scarf.",
  details: "Silk twill\r\n\n  Hand-rolled edges  \n",
  imageUrl: "https://images.unsplash.com/photo-123?w=2000",
  imageAlt: "Ivory scarf",
  imageFit: "contain",
  position: "",
  stock: "3",
};

describe("parsePriceCents", () => {
  it.each([
    ["1250", 125000],
    ["1250.5", 125050],
    ["1250.50", 125050],
    ["1,250.05", 125005],
    ["$12,500", 1250000],
    ["0", 0],
  ])("parses %s", (raw, cents) => expect(parsePriceCents(raw)).toBe(cents));

  it.each(["", "-5", "12.345", "1,25", "12e3", "abc", "10000000.01"])(
    "rejects %s",
    (raw) => expect(parsePriceCents(raw)).toBeUndefined(),
  );

  it("round-trips through the input value", () => {
    expect(priceInputValue(125050)).toBe("1250.50");
    expect(parsePriceCents(priceInputValue(99))).toBe(99);
  });
});

describe("parseProductForm", () => {
  it("returns typed input for a valid form", () => {
    const { errors, input, stock } = parseProductForm(
      form(validProduct),
      "create",
    );
    expect(errors).toEqual({});
    expect(stock).toBe(3);
    expect(input).toEqual({
      name: "Silk Scarf",
      slug: "silk-scarf-ivory",
      sku: "CV-AC-2001",
      categoryId: 4,
      color: "white",
      priceCents: 125050,
      description: "A scarf.",
      details: ["Silk twill", "Hand-rolled edges"],
      imageUrl: "https://images.unsplash.com/photo-123?w=2000",
      imageAlt: "Ivory scarf",
      imageFit: "contain",
      isNew: false,
      position: undefined,
    });
  });

  it("reports each invalid field and returns no input", () => {
    const { errors, input, values } = parseProductForm(
      form({
        ...validProduct,
        name: "",
        slug: "Silk Scarf",
        color: "purple",
        price: "-1",
        imageUrl: "https://example.com/a.jpg",
        imageFit: "stretch",
        stock: "1.5",
      }),
      "create",
    );
    expect(input).toBeUndefined();
    expect(Object.keys(errors).sort()).toEqual(
      [
        "name",
        "slug",
        "color",
        "price",
        "imageUrl",
        "imageFit",
        "stock",
      ].sort(),
    );
    // What was typed is echoed back.
    expect(values.slug).toBe("Silk Scarf");
  });

  it("ignores stock when editing", () => {
    const { errors, input } = parseProductForm(
      form({ ...validProduct, stock: "", isNew: "on", position: "25" }),
      "edit",
    );
    expect(errors).toEqual({});
    expect(input).toMatchObject({ isNew: true, position: 25 });
  });
});

describe("images and slugs", () => {
  it("only allows https Unsplash images", () => {
    expect(isAllowedImageUrl("https://images.unsplash.com/photo-1")).toBe(true);
    expect(isAllowedImageUrl("http://images.unsplash.com/photo-1")).toBe(false);
    expect(isAllowedImageUrl("https://images.unsplash.com.evil.io/x")).toBe(
      false,
    );
    expect(isAllowedImageUrl("not a url")).toBe(false);
  });

  it("suggests slugs from names", () => {
    expect(slugify("  Silk Scarf, Ivory ")).toBe("silk-scarf-ivory");
    expect(slugify("Crème Brûlée — Tote")).toBe("creme-brulee-tote");
  });
});

describe("parseCategoryForm", () => {
  it("accepts a valid category with an optional position", () => {
    const { input } = parseCategoryForm(
      form({
        name: "Bags",
        slug: "bags",
        description: "Leather.",
        position: "",
      }),
    );
    expect(input).toEqual({
      name: "Bags",
      slug: "bags",
      description: "Leather.",
      position: undefined,
    });
  });

  it("rejects a bad slug and position", () => {
    const { errors } = parseCategoryForm(
      form({ name: "Bags", slug: "-bags", description: "x", position: "-1" }),
    );
    expect(Object.keys(errors).sort()).toEqual(["position", "slug"]);
  });
});

describe("parseStockForm", () => {
  it("parses a stock update", () => {
    expect(
      parseStockForm(form({ productId: "7", expected: "2", quantity: "10" }))
        .input,
    ).toEqual({ productId: 7, expected: 2, quantity: 10 });
  });

  it("marks a product sold out whatever the quantity field holds", () => {
    expect(
      parseStockForm(
        form({
          productId: "7",
          expected: "4",
          quantity: "not a number",
          intent: "sold-out",
        }),
      ).input,
    ).toEqual({ productId: 7, expected: 4, quantity: 0 });
  });

  it("caps the quantity at STOCK_MAX, or at the current stock above it", () => {
    const parse = (expected: number, quantity: number) =>
      parseStockForm(
        form({
          productId: "7",
          expected: String(expected),
          quantity: String(quantity),
        }),
      );
    expect(parse(5, STOCK_MAX + 1).errors.quantity).toMatch(String(STOCK_MAX));
    // Released checkout units took stock past the maximum: it can still be
    // saved unchanged or lowered, but not raised.
    const above = STOCK_MAX + 3;
    expect(parse(above, above).input?.quantity).toBe(above);
    expect(parse(above, above - 1).input?.quantity).toBe(above - 1);
    expect(parse(above, above + 1).errors.quantity).toMatch(String(above));
  });

  it("rejects an unknown intent", () => {
    expect(
      parseStockForm(
        form({
          productId: "7",
          expected: "4",
          quantity: "1",
          intent: "delete",
        }),
      ).invalid,
    ).toBe(true);
  });

  it("rejects a bad quantity and tampered hidden fields", () => {
    expect(
      parseStockForm(form({ productId: "7", expected: "2", quantity: "-1" }))
        .errors.quantity,
    ).toMatch(/whole number/);
    expect(
      parseStockForm(form({ productId: "x", expected: "2", quantity: "1" }))
        .invalid,
    ).toBe(true);
  });
});

describe("admin URL state", () => {
  it("builds hrefs without empty params", () => {
    expect(adminHref("/admin/products")).toBe("/admin/products");
    expect(
      adminHref("/admin/products", { category: "bags", q: undefined }),
    ).toBe("/admin/products?category=bags");
  });

  it("parses ids and pages strictly", () => {
    expect(parseRouteId("12")).toBe(12);
    for (const bad of ["0", "012", "1.5", "abc", "99999999999"])
      expect(parseRouteId(bad)).toBeUndefined();
    expect(parsePage("3")).toBe(3);
    expect(parsePage("-1")).toBe(1);
    expect(parsePage(undefined)).toBe(1);
  });

  it("maps order filters to statuses", () => {
    expect(parseOrderFilter(undefined)).toBe("placed");
    expect(parseOrderFilter("bogus")).toBe("placed");
    expect(orderFilterStatuses("placed")).toEqual([
      "paid",
      "processing",
      "failed",
    ]);
    expect(orderFilterStatuses("pending")).toEqual(["pending"]);
    expect(parseOrderFilter("reconcile")).toBe("reconcile");
    expect(orderFilterStatuses("reconcile")).toEqual(["pending"]);
    expect(orderFilterStatuses("all")).toBeUndefined();
  });
});

describe("parseStockAdjustForm", () => {
  const adjust = (values: Record<string, string>) =>
    parseStockAdjustForm(
      form({
        productId: "7",
        direction: "in",
        amount: "1",
        note: "",
        ...values,
      }),
    );

  it("turns direction and amount into a signed delta", () => {
    expect(adjust({ amount: "5" }).input).toEqual({
      productId: 7,
      delta: 5,
      note: undefined,
    });
    expect(
      adjust({ direction: "out", amount: "2", note: "  Damaged  " }).input,
    ).toEqual({ productId: 7, delta: -2, note: "Damaged" });
  });

  it.each(["0", "-1", "1.5", "", String(STOCK_MAX + 1)])(
    "rejects amount %s",
    (amount) => expect(adjust({ amount }).errors.amount).toMatch(/1 to/),
  );

  it("accepts the bounds", () => {
    expect(adjust({ amount: "1" }).input?.delta).toBe(1);
    expect(adjust({ amount: String(STOCK_MAX) }).input?.delta).toBe(STOCK_MAX);
  });

  it("echoes the direction with an error, so the form keeps a write-off", () => {
    const parsed = adjust({ direction: "out", amount: "0" });
    expect(parsed.errors.amount).toBeDefined();
    expect(parsed.values.direction).toBe("out");
  });

  it("limits the note", () => {
    expect(adjust({ note: "x".repeat(201) }).errors.note).toMatch(/200/);
    expect(adjust({ note: "x".repeat(200) }).input).toBeDefined();
  });

  it("treats a tampered direction or product id as invalid", () => {
    expect(adjust({ direction: "sideways" }).invalid).toBe(true);
    expect(adjust({ productId: "0" }).invalid).toBe(true);
  });
});
