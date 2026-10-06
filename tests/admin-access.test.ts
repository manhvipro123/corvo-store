/// <reference types="vite/client" />
import { readFileSync } from "node:fs";
import { fileURLToPath } from "node:url";

import { beforeEach, describe, expect, it, vi } from "vitest";

/**
 * The admin area's access rules: `requireAdmin` itself, the layout (which
 * must not show the admin shell to non-admins) and a guard on every page.
 */

const redirected = new Error("NEXT_REDIRECT");
const notFoundError = new Error("NEXT_HTTP_ERROR_FALLBACK;404");

const getSession = vi.fn();
vi.mock("@/lib/auth", () => ({ auth: { api: { getSession } } }));
vi.mock("next/headers", () => ({ headers: vi.fn(async () => new Headers()) }));
vi.mock("next/navigation", () => ({
  redirect: vi.fn(() => {
    throw redirected;
  }),
  notFound: vi.fn(() => {
    throw notFoundError;
  }),
  usePathname: vi.fn(() => "/admin"),
}));
// React's request `cache` would keep the first session across tests.
vi.mock("react", async (original) => ({
  ...(await original<typeof import("react")>()),
  cache: <T>(fn: T) => fn,
}));

const { redirect, notFound } = await import("next/navigation");
const { requireAdmin } = await import("@/lib/session");
const { default: AdminLayout } = await import("@/app/admin/layout");

const session = (role: string | null) => ({
  user: { id: "u1", email: "a@example.test", name: "A", role },
  session: { id: "s1" },
});

describe("requireAdmin", () => {
  beforeEach(() => vi.clearAllMocks());

  it("sends signed-out visitors to sign-in, back to the page after", async () => {
    getSession.mockResolvedValue(null);
    await expect(requireAdmin("/admin/products/3")).rejects.toBe(redirected);
    expect(redirect).toHaveBeenCalledWith(
      "/sign-in?callbackURL=%2Fadmin%2Fproducts%2F3",
    );
  });

  it.each([["user"], [null], ["useradmin"]])(
    "404s for role %s, so admin routes stay hidden",
    async (role) => {
      getSession.mockResolvedValue(session(role));
      await expect(requireAdmin("/admin")).rejects.toBe(notFoundError);
      expect(notFound).toHaveBeenCalledOnce();
    },
  );

  it.each([["admin"], ["user,admin"]])("lets role %s in", async (role) => {
    getSession.mockResolvedValue(session(role));
    await expect(requireAdmin("/admin")).resolves.toMatchObject({
      user: { role },
    });
  });
});

describe("admin layout", () => {
  beforeEach(() => vi.clearAllMocks());

  it.each([[null], [session("user")]])(
    "renders only the page (which refuses) without an admin session",
    async (value) => {
      getSession.mockResolvedValue(value);
      const page = "page";
      expect(await AdminLayout({ children: page } as never)).toBe(page);
    },
  );

  it("wraps the page in the admin shell for admins", async () => {
    getSession.mockResolvedValue(session("admin"));
    expect(await AdminLayout({ children: "page" } as never)).not.toBe("page");
  });
});

describe("admin pages", () => {
  const pages = Object.keys(import.meta.glob("../src/app/admin/**/page.tsx"));

  it("are discovered", () => {
    expect(pages.length).toBeGreaterThanOrEqual(1);
  });

  // The layout is not a check (it doesn't re-run on client navigation), so
  // each page must call the guard itself.
  it.each(pages)("%s calls requireAdmin", (path) => {
    const source = readFileSync(
      fileURLToPath(new URL(path, import.meta.url)),
      "utf8",
    );
    expect(source).toMatch(/await requireAdmin\(/);
  });
});
