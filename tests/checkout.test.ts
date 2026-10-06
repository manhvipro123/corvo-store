import { describe, expect, it } from "vitest";

import {
  amountMatches,
  subtotalOf,
  toLineItems,
  transitionFor,
} from "@/lib/checkout";

const line = {
  productId: 7,
  name: "Brogue lace-up boot",
  sku: "CV-SH-2003",
  imageUrl: "https://images.unsplash.com/x",
  unitPriceCents: 129_000,
  quantity: 2,
};

describe("toLineItems", () => {
  it("prices every line from the server snapshot, in USD cents", () => {
    expect(toLineItems([line])).toEqual([
      {
        quantity: 2,
        price_data: {
          currency: "usd",
          unit_amount: 129_000,
          product_data: {
            name: "Brogue lace-up boot",
            images: ["https://images.unsplash.com/x"],
            metadata: { product_id: "7", sku: "CV-SH-2003" },
          },
        },
      },
    ]);
    expect(
      subtotalOf([line, { ...line, unitPriceCents: 1250, quantity: 1 }]),
    ).toBe(259_250);
  });
});

describe("transitionFor (webhook events)", () => {
  it.each([
    ["checkout.session.completed", "paid", "paid", ["pending"], false],
    [
      "checkout.session.completed",
      "no_payment_required",
      "paid",
      ["pending"],
      false,
    ],
    ["checkout.session.completed", "unpaid", "processing", ["pending"], false],
    [
      "checkout.session.async_payment_succeeded",
      "paid",
      "paid",
      ["processing"],
      false,
    ],
    [
      "checkout.session.async_payment_failed",
      "unpaid",
      "failed",
      ["processing"],
      true,
    ],
    ["checkout.session.expired", "unpaid", "expired", ["pending"], true],
  ] as const)("%s (%s) → %s", (type, payment, to, from, release) => {
    expect(transitionFor(type, payment)).toEqual({ to, from, release });
  });

  it("never moves a paid order", () => {
    for (const type of [
      "checkout.session.expired",
      "checkout.session.async_payment_failed",
    ])
      expect(transitionFor(type, "unpaid")?.from).not.toContain("paid");
  });

  it("ignores other events", () => {
    expect(transitionFor("payment_intent.succeeded", "paid")).toBeNull();
  });
});

describe("amountMatches", () => {
  it("requires exactly our subtotal in USD", () => {
    expect(amountMatches({ amount_total: 2500, currency: "usd" }, 2500)).toBe(
      true,
    );
    expect(amountMatches({ amount_total: 2400, currency: "usd" }, 2500)).toBe(
      false,
    );
    expect(amountMatches({ amount_total: 2500, currency: "eur" }, 2500)).toBe(
      false,
    );
    expect(amountMatches({ amount_total: null, currency: "usd" }, 2500)).toBe(
      false,
    );
  });
});
