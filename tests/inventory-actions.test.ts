import { beforeEach, describe, expect, it, vi } from "vitest";

/** How the stock actions turn write outcomes into what the admin sees. */

vi.mock("@/lib/session", () => ({
  requireAdmin: vi.fn(async () => ({ user: { id: "admin-1" } })),
}));
vi.mock("@/db/catalog-admin", async (original) => ({
  ...(await original<typeof import("@/db/catalog-admin")>()),
  setStock: vi.fn(),
  adjustStock: vi.fn(),
}));
vi.mock("@/db", () => ({ db: {} }));
vi.mock("@/lib/checkout-session", () => ({
  releaseStalePendingOrders: vi.fn(),
}));
const revalidateStorefront = vi.fn();
vi.mock("@/lib/storefront-cache", () => ({ revalidateStorefront }));
vi.mock("next/cache", () => ({ refresh: vi.fn() }));

const catalog = await import("@/db/catalog-admin");
const { refresh } = await import("next/cache");
const { updateStock, adjustStock } =
  await import("@/app/admin/inventory/actions");

const form = (values: Record<string, string>) => {
  const data = new FormData();
  for (const [key, value] of Object.entries(values)) data.set(key, value);
  return data;
};
const set = (values: Record<string, string> = {}) =>
  updateStock(
    {},
    form({ productId: "1", expected: "4", quantity: "6", ...values }),
  );
const adjust = (values: Record<string, string> = {}) =>
  adjustStock(
    {},
    form({
      productId: "1",
      direction: "out",
      amount: "2",
      note: "",
      ...values,
    }),
  );

describe("updateStock", () => {
  beforeEach(() => vi.clearAllMocks());

  it("saves, refreshes the storefront and confirms", async () => {
    expect(await set()).toEqual({ saved: "Saved: 6 available." });
    expect(revalidateStorefront).toHaveBeenCalledOnce();
    expect(await set({ intent: "sold-out" })).toEqual({
      saved: "Saved: now sold out.",
    });
    expect(catalog.setStock).toHaveBeenLastCalledWith(
      { productId: 1, expected: 4, quantity: 0 },
      "admin-1",
    );
  });

  it("keeps the typed value and re-renders on a stale save", async () => {
    vi.mocked(catalog.setStock).mockRejectedValueOnce(
      new catalog.StockChangedError(3),
    );
    const state = await set();
    expect(state.formError).toMatch(/changed to 3/);
    expect(state.quantity).toBe("6");
    expect(refresh).toHaveBeenCalledOnce();
    expect(revalidateStorefront).not.toHaveBeenCalled();
  });

  it("never writes invalid or tampered input", async () => {
    expect((await set({ quantity: "-1" })).fieldError).toMatch(/whole number/);
    expect((await set({ intent: "delete" })).formError).toBeDefined();
    expect((await set({ expected: "abc" })).formError).toBeDefined();
    expect(catalog.setStock).not.toHaveBeenCalled();
  });
});

describe("adjustStock", () => {
  beforeEach(() => vi.clearAllMocks());

  it("confirms an adjustment", async () => {
    expect(await adjust({ direction: "in", amount: "1" })).toEqual({
      saved: "Added 1 unit.",
    });
    expect(await adjust()).toEqual({ saved: "Removed 2 units." });
    expect(revalidateStorefront).toHaveBeenCalledTimes(2);
  });

  it("explains a write-off larger than the stock", async () => {
    vi.mocked(catalog.adjustStock).mockRejectedValueOnce(
      new catalog.InsufficientStockError(1),
    );
    const state = await adjust();
    expect(state.fieldErrors?.amount).toMatch(/Only 1 available/);
    expect(state.values).toEqual({ amount: "2", note: "" });
    expect(revalidateStorefront).not.toHaveBeenCalled();
  });

  it("explains going over the maximum", async () => {
    vi.mocked(catalog.adjustStock).mockRejectedValueOnce(
      new catalog.StockLimitError(99_999),
    );
    expect((await adjust({ direction: "in" })).fieldErrors?.amount).toMatch(
      /above the maximum/,
    );
  });
});
