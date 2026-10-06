import { describe, expect, it } from "vitest";

import { isAdmin, safeCallbackURL, signInHref } from "@/lib/auth-redirect";

describe("safeCallbackURL", () => {
  it.each(["/account", "/products?category=bags", "/admin"])(
    "keeps same-site path %s",
    (path) => expect(safeCallbackURL(path)).toBe(path),
  );

  it.each([
    "https://evil.com",
    "//evil.com",
    "/\\evil.com",
    "\\/evil.com",
    // Browsers drop tabs and newlines, so these mean "//evil.com".
    "/\t/evil.com",
    "/\n/evil.com",
    "/\r\n/evil.com",
    // Dot segments resolve to "//evil.com".
    "/.//evil.com",
    "/a/..//evil.com",
    "/%2e//evil.com",
    "javascript:alert(1)",
    "",
    undefined,
    null,
    42,
  ])("rejects %j", (value) => {
    expect(safeCallbackURL(value)).toBe("/account");
  });

  it("returns the path as a browser resolves it", () => {
    expect(safeCallbackURL("/acc\tount")).toBe("/account");
    expect(safeCallbackURL("/a/../admin?x=1#top")).toBe("/admin?x=1#top");
  });
});

describe("signInHref", () => {
  it("encodes the return path", () => {
    expect(signInHref("/products?x=1")).toBe(
      "/sign-in?callbackURL=%2Fproducts%3Fx%3D1",
    );
  });
});

describe("isAdmin", () => {
  it.each([
    ["admin", true],
    ["user,admin", true],
    ["user, admin", true],
    ["user", false],
    ["administrator", false],
    ["", false],
    [null, false],
    [undefined, false],
  ] as const)("%s → %s", (role, expected) => {
    expect(isAdmin(role)).toBe(expected);
  });
});
