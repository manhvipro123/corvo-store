import { describe, expect, it } from "vitest";

import {
  PASSWORD_MAX_LENGTH,
  PASSWORD_MIN_LENGTH,
  validateAuthForm,
  validateField,
  validatePasswordChange,
} from "@/lib/auth-validation";

describe("validateField", () => {
  it("requires every field", () => {
    expect(validateField("sign-up", "name", "  ")).toBe("Enter your name.");
    expect(validateField("sign-in", "email", "")).toBe(
      "Enter your email address.",
    );
    expect(validateField("sign-in", "password", "")).toBe(
      "Enter your password.",
    );
  });

  it.each(["name@example.com", "  a.b+tag@shop.co.uk  "])(
    "accepts email %s",
    (email) => expect(validateField("sign-in", "email", email)).toBeUndefined(),
  );

  it.each(["name", "name@", "name@example", "na me@example.com", "@x.io"])(
    "rejects email %s",
    (email) =>
      expect(validateField("sign-in", "email", email)).toMatch(/valid email/),
  );

  it("enforces the minimum password length only at sign-up", () => {
    const short = "a".repeat(PASSWORD_MIN_LENGTH - 1);
    expect(validateField("sign-up", "password", short)).toMatch(/at least 8/);
    expect(validateField("sign-in", "password", short)).toBeUndefined();
    expect(
      validateField("sign-up", "password", "a".repeat(PASSWORD_MIN_LENGTH)),
    ).toBeUndefined();
  });

  it("rejects over-long passwords in both modes", () => {
    const long = "a".repeat(PASSWORD_MAX_LENGTH + 1);
    expect(validateField("sign-up", "password", long)).toMatch(/or fewer/);
    expect(validateField("sign-in", "password", long)).toMatch(/or fewer/);
  });

  it("keeps password whitespace (it may be intentional)", () => {
    expect(validateField("sign-up", "password", "        ")).toBeUndefined();
  });
});

describe("validateAuthForm", () => {
  it("checks only the fields of the given mode", () => {
    expect(
      validateAuthForm("sign-in", { email: "a@b.co", password: "x" }),
    ).toEqual({});
    expect(
      Object.keys(validateAuthForm("sign-up", { email: "a@b.co" })),
    ).toEqual(["name", "password"]);
  });
});

describe("validatePasswordChange", () => {
  const valid = "a".repeat(PASSWORD_MIN_LENGTH);

  it("requires both passwords", () => {
    expect(
      validatePasswordChange({ currentPassword: "", newPassword: "" }),
    ).toEqual({
      currentPassword: "Enter your current password.",
      newPassword: "Enter a new password.",
    });
  });

  it("accepts any current password but applies sign-up rules to the new one", () => {
    expect(
      validatePasswordChange({ currentPassword: "short", newPassword: "tiny" }),
    ).toEqual({
      newPassword: `Use at least ${PASSWORD_MIN_LENGTH} characters.`,
    });
    expect(
      validatePasswordChange({
        currentPassword: "short",
        newPassword: "a".repeat(PASSWORD_MAX_LENGTH + 1),
      }).newPassword,
    ).toMatch(/or fewer/);
  });

  it("rejects reusing the current password", () => {
    expect(
      validatePasswordChange({ currentPassword: valid, newPassword: valid })
        .newPassword,
    ).toMatch(/different/);
    expect(
      validatePasswordChange({ currentPassword: "old", newPassword: valid }),
    ).toEqual({});
  });
});
