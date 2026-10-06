/// <reference types="vite/client" />
import { beforeEach, describe, expect, it, vi } from "vitest";

/**
 * Every admin Server Action must check `requireAdmin` before it reads the
 * form or touches the database: Server Actions are public POST endpoints
 * that can be called from any page, so neither the proxy nor hidden links
 * protect them. Here `requireAdmin` always refuses (as it does for a
 * signed-in non-admin), so no catalog write may happen.
 *
 * Actions are discovered from `src/app/admin/** /actions.ts`, so a new one is
 * covered without being listed here.
 */

const refused = new Error("NEXT_HTTP_ERROR_FALLBACK;404");

vi.mock("@/lib/session", () => ({
  requireAdmin: vi.fn(async () => {
    throw refused;
  }),
  requireUser: vi.fn(),
  getSession: vi.fn(),
}));
vi.mock("@/db/catalog-admin", () => ({
  createProduct: vi.fn(),
  updateProduct: vi.fn(),
  createCategory: vi.fn(),
  updateCategory: vi.fn(),
  deleteCategory: vi.fn(),
  setStock: vi.fn(),
}));
vi.mock("next/cache", () => ({ revalidatePath: vi.fn(), refresh: vi.fn() }));
vi.mock("next/navigation", () => ({ redirect: vi.fn(), notFound: vi.fn() }));

const catalog = await import("@/db/catalog-admin");
const { requireAdmin } = await import("@/lib/session");

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

describe("admin Server Actions", () => {
  beforeEach(() => vi.clearAllMocks());

  it("are discovered", () => {
    expect(actions.length).toBeGreaterThanOrEqual(6);
  });

  it.each(actions)("%s refuses non-admins before writing", async (_, run) => {
    // Covers every signature: (state, data), (id, state, data) and (id).
    await expect(run(1, {}, new FormData())).rejects.toBe(refused);
    expect(requireAdmin).toHaveBeenCalledOnce();
    for (const write of Object.values(catalog))
      expect(write).not.toHaveBeenCalled();
  });
});
