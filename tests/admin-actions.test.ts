/// <reference types="vite/client" />
import { beforeEach, describe, expect, it, vi } from "vitest";

/**
 * Every admin Server Action must check `requireAdmin` before it reads the
 * form or touches the database: Server Actions are public POST endpoints
 * that can be called from any page, so neither the proxy nor hidden links
 * protect them.
 *
 * Actions are discovered from `src/app/admin/** /actions.ts`, so a new one is
 * covered without being listed here. Every module that writes stock or
 * catalog data is mocked, and `@/db` itself throws if anything reaches it.
 */

const refused = new Error("NEXT_HTTP_ERROR_FALLBACK;404");
const admin = { user: { id: "admin-1", role: "admin" } };

vi.mock("@/lib/session", () => ({
  requireAdmin: vi.fn(),
  requireUser: vi.fn(),
  getSession: vi.fn(),
}));
vi.mock("@/db", () => ({
  db: new Proxy(
    {},
    {
      get() {
        throw new Error("admin action reached the database directly");
      },
    },
  ),
}));
vi.mock("@/db/catalog-admin", async (original) => {
  const real = await original<typeof import("@/db/catalog-admin")>();
  return {
    // Keep the error classes; replace every write.
    ...real,
    createProduct: vi.fn(async () => 1),
    updateProduct: vi.fn(),
    createCategory: vi.fn(),
    updateCategory: vi.fn(),
    deleteCategory: vi.fn(),
    setStock: vi.fn(),
    adjustStock: vi.fn(),
  };
});
vi.mock("@/db/orders", () => ({
  releaseOrder: vi.fn(),
  reserveOrder: vi.fn(),
  applyTransition: vi.fn(),
  attachCheckoutSession: vi.fn(),
}));
vi.mock("@/lib/checkout-session", () => ({
  releaseStalePendingOrders: vi.fn(async () => ({
    released: 0,
    needsReconcile: 0,
    skipped: 0,
  })),
  cancelPendingCheckout: vi.fn(),
}));
vi.mock("next/cache", () => ({ revalidatePath: vi.fn(), refresh: vi.fn() }));
vi.mock("next/navigation", () => ({ redirect: vi.fn(), notFound: vi.fn() }));

const catalog = await import("@/db/catalog-admin");
const orders = await import("@/db/orders");
const checkout = await import("@/lib/checkout-session");
const { requireAdmin } = await import("@/lib/session");

/** Every mocked write; none may run before (or without) the admin check. */
const writes = [
  catalog.createProduct,
  catalog.updateProduct,
  catalog.createCategory,
  catalog.updateCategory,
  catalog.deleteCategory,
  catalog.setStock,
  catalog.adjustStock,
  ...Object.values(orders),
  checkout.releaseStalePendingOrders,
  checkout.cancelPendingCheckout,
].map((fn) => vi.mocked(fn as (...args: unknown[]) => unknown));

const modules = import.meta.glob("../src/app/admin/**/actions.ts") as Record<
  string,
  () => Promise<Record<string, unknown>>
>;
const actions: [string, (...args: unknown[]) => Promise<unknown>][] = [];
for (const [path, load] of Object.entries(modules)) {
  for (const [name, value] of Object.entries(await load())) {
    if (typeof value === "function")
      actions.push([
        `${path.replace("../src/app", "")} ${name}`,
        value as never,
      ]);
  }
}

const form = (values: Record<string, string>) => {
  const data = new FormData();
  for (const [key, value] of Object.entries(values)) data.set(key, value);
  return data;
};

const product = {
  name: "Silk Scarf",
  slug: "silk-scarf-ivory",
  sku: "CV-AC-2001",
  categoryId: "4",
  color: "white",
  price: "1250",
  description: "A scarf.",
  details: "Silk twill",
  imageUrl: "https://images.unsplash.com/photo-123?w=2000",
  imageAlt: "Ivory scarf",
  imageFit: "contain",
  position: "",
  stock: "3",
};
const category = {
  name: "Scarves",
  slug: "scarves",
  description: "Silk.",
  position: "",
};
const productActions = () => import("@/app/admin/products/actions");
const categoryActions = () => import("@/app/admin/categories/actions");

describe("admin Server Actions", () => {
  beforeEach(() => vi.clearAllMocks());

  it("are discovered, including the stock actions", () => {
    const names = actions.map(([name]) => name);
    for (const expected of [
      "/admin/inventory/actions.ts updateStock",
      "/admin/inventory/actions.ts adjustStock",
      "/admin/inventory/actions.ts releaseExpiredHolds",
      "/admin/products/actions.ts createProduct",
    ])
      expect(names).toContain(expected);
  });

  it.each(actions)("%s refuses non-admins before writing", async (_, run) => {
    vi.mocked(requireAdmin).mockRejectedValue(refused);
    // Covers every signature: (state, data), (id, state, data) and (id).
    await expect(run(1, {}, new FormData())).rejects.toBe(refused);
    expect(requireAdmin).toHaveBeenCalledOnce();
    for (const write of writes) expect(write).not.toHaveBeenCalled();
  });

  // With valid input the write does happen, and strictly after the check.
  it.each([
    [
      "updateStock",
      () =>
        import("@/app/admin/inventory/actions").then((m) =>
          m.updateStock(
            {},
            form({ productId: "1", expected: "2", quantity: "5" }),
          ),
        ),
      catalog.setStock,
    ],
    [
      "adjustStock",
      () =>
        import("@/app/admin/inventory/actions").then((m) =>
          m.adjustStock(
            {},
            form({ productId: "1", direction: "out", amount: "2", note: "" }),
          ),
        ),
      catalog.adjustStock,
    ],
    [
      "releaseExpiredHolds",
      () =>
        import("@/app/admin/inventory/actions").then((m) =>
          m.releaseExpiredHolds(),
        ),
      checkout.releaseStalePendingOrders,
    ],
    [
      "createProduct",
      () => productActions().then((m) => m.createProduct({}, form(product))),
      catalog.createProduct,
    ],
    [
      "updateProduct",
      () =>
        productActions().then((m) => m.updateProduct(1, {}, form(product))),
      catalog.updateProduct,
    ],
    [
      "createCategory",
      () =>
        categoryActions().then((m) => m.createCategory({}, form(category))),
      catalog.createCategory,
    ],
    [
      "updateCategory",
      () =>
        categoryActions().then((m) =>
          m.updateCategory(1, {}, form(category)),
        ),
      catalog.updateCategory,
    ],
    [
      "deleteCategory",
      () => categoryActions().then((m) => m.deleteCategory(1)),
      catalog.deleteCategory,
    ],
  ] as const)("%s writes only after requireAdmin", async (_, run, write) => {
    vi.mocked(requireAdmin).mockResolvedValue(admin as never);
    await run();
    const check = vi.mocked(requireAdmin).mock.invocationCallOrder[0];
    const written = vi.mocked(write).mock.invocationCallOrder[0];
    // The valid input must reach the write, or this proves nothing.
    expect(written).toBeDefined();
    expect(written).toBeGreaterThan(check);
  });

  it("records the signed-in admin, never a value from the form", async () => {
    vi.mocked(requireAdmin).mockResolvedValue(admin as never);
    const { updateStock, adjustStock } =
      await import("@/app/admin/inventory/actions");
    await updateStock(
      {},
      form({ productId: "1", expected: "2", quantity: "5", actorUserId: "x" }),
    );
    expect(catalog.setStock).toHaveBeenCalledWith(
      { productId: 1, expected: 2, quantity: 5 },
      "admin-1",
    );
    await adjustStock(
      {},
      form({ productId: "1", direction: "in", amount: "3", note: "Delivery" }),
    );
    expect(catalog.adjustStock).toHaveBeenCalledWith({
      productId: 1,
      delta: 3,
      note: "Delivery",
      actorUserId: "admin-1",
    });
  });
});
