import { describe, expect, it } from "vitest";

import {
  MAX_BAG_LINES,
  MAX_LINE_QUANTITY,
  buildBag,
  parseBag,
  readPositiveInt,
  serializeBag,
  withoutOrdered,
} from "@/lib/bag";
import type { Product } from "@/types/catalog";

const product = (id: number, priceCents: number, stock: number): Product => ({
  id,
  slug: `p-${id}`,
  name: `Piece ${id}`,
  category: "bags",
  categoryName: "Bags",
  color: "black",
  priceCents,
  image: { src: "/x.jpg", alt: "" },
  sku: `SKU-${id}`,
  description: "",
  details: [],
  stock,
});

describe("parseBag / serializeBag", () => {
  it("round-trips ids and quantities", () => {
    const items = [
      { productId: 12, quantity: 1 },
      { productId: 40, quantity: 2 },
    ];
    expect(serializeBag(items)).toBe("12:1.40:2");
    expect(parseBag("12:1.40:2")).toEqual(items);
  });

  it("drops ids beyond a Postgres integer", () => {
    expect(parseBag("2147483648:1.7:2")).toEqual([
      { productId: 7, quantity: 2 },
    ]);
  });

  it("drops malformed, zero, negative and duplicate entries", () => {
    expect(parseBag("12:1.x:2.3:0.-4:1.5:1.5.12:9.7:2.5e3:1")).toEqual([
      { productId: 12, quantity: 1 },
      { productId: 5, quantity: 1 },
      { productId: 7, quantity: 2 },
    ]);
    expect(parseBag(undefined)).toEqual([]);
    expect(parseBag("")).toEqual([]);
  });

  it(`keeps at most ${MAX_BAG_LINES} lines`, () => {
    const value = Array.from({ length: 60 }, (_, i) => `${i + 1}:1`).join(".");
    expect(parseBag(value)).toHaveLength(MAX_BAG_LINES);
  });
});

describe("readPositiveInt", () => {
  it.each([
    ["3", 3],
    ["0", null],
    ["-1", null],
    ["1.5", null],
    ["", null],
    ["9".repeat(20), null],
    ["2147483647", 2147483647],
    ["2147483648", null],
    [null, null],
  ])("%s → %s", (input, expected) =>
    expect(readPositiveInt(input)).toBe(expected),
  );
});

describe("buildBag", () => {
  it("prices lines from live products and sums the subtotal in cents", () => {
    const bag = buildBag(
      [
        { productId: 1, quantity: 2 },
        { productId: 2, quantity: 1 },
      ],
      [product(1, 12_50, 5), product(2, 2650_00, 1)],
    );
    expect(bag.lines.map((l) => l.totalCents)).toEqual([25_00, 2650_00]);
    expect(bag.subtotalCents).toBe(2675_00);
    expect(bag.itemCount).toBe(3);
    expect(bag.adjustments).toEqual([]);
  });

  it("lowers quantities above stock and says so", () => {
    const bag = buildBag([{ productId: 1, quantity: 4 }], [product(1, 100, 2)]);
    expect(bag.lines[0].quantity).toBe(2);
    expect(bag.items).toEqual([{ productId: 1, quantity: 2 }]);
    expect(bag.subtotalCents).toBe(200);
    expect(bag.adjustments[0]).toMatch(/Only 2 of Piece 1 left/);
  });

  it(`caps a line at ${MAX_LINE_QUANTITY}, however much is in stock`, () => {
    const bag = buildBag(
      [{ productId: 1, quantity: 500 }],
      [product(1, 100, 1000)],
    );
    expect(bag.lines[0].quantity).toBe(MAX_LINE_QUANTITY);
    expect(bag.items).toEqual([{ productId: 1, quantity: MAX_LINE_QUANTITY }]);
    expect(bag.adjustments[0]).toMatch(/up to 10 of Piece 1/);
  });

  it("keeps sold-out lines without charging them", () => {
    const bag = buildBag(
      [
        { productId: 1, quantity: 2 },
        { productId: 2, quantity: 1 },
      ],
      [product(1, 100, 0), product(2, 300, 3)],
    );
    expect(bag.lines[0]).toMatchObject({ quantity: 0, totalCents: 0 });
    expect(bag.items[0]).toEqual({ productId: 1, quantity: 2 });
    expect(bag.subtotalCents).toBe(300);
    expect(bag.itemCount).toBe(1);
  });

  it("drops products that no longer exist", () => {
    const bag = buildBag([{ productId: 9, quantity: 1 }], []);
    expect(bag.lines).toEqual([]);
    expect(bag.items).toEqual([]);
    expect(bag.adjustments[0]).toMatch(/no longer available/);
  });
});

describe("withoutOrdered", () => {
  it("takes off what the order bought and keeps pieces added since", () => {
    expect(
      withoutOrdered(
        [
          { productId: 1, quantity: 3 },
          { productId: 2, quantity: 1 },
          { productId: 3, quantity: 2 },
        ],
        [
          { productId: 1, quantity: 1 },
          { productId: 2, quantity: 1 },
          { productId: 9, quantity: 4 },
        ],
      ),
    ).toEqual([
      { productId: 1, quantity: 2 },
      { productId: 3, quantity: 2 },
    ]);
  });
});
