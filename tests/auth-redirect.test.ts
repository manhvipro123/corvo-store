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
    "javascript:alert(1)",
    "",
    undefined,
    null,
    42,
  ])("rejects %s", (value) => {
    expect(safeCallbackURL(value)).toBe("/account");
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
