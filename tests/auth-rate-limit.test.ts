import { beforeEach, describe, expect, it, vi } from "vitest";

/**
 * Better Auth's own rate limit doesn't cover `auth.api.*` calls from Server
 * Actions, so the actions that check a password count attempts themselves,
 * before Better Auth sees the password.
 */

const consumeRateLimit = vi.fn<
  (key: string, rule: unknown) => Promise<boolean>
>(async () => true);
vi.mock("@/db/rate-limit", () => ({ consumeRateLimit }));
const signInEmail = vi.fn();
vi.mock("@/lib/auth", () => ({ auth: { api: { signInEmail } } }));
const requestHeaders = new Headers({ "x-forwarded-for": "203.0.113.7" });
vi.mock("next/headers", () => ({ headers: vi.fn(async () => requestHeaders) }));
const redirect = vi.fn();
vi.mock("next/navigation", () => ({ redirect }));

const { TOO_MANY_ATTEMPTS, tooManyAttempts } =
  await import("@/lib/auth-rate-limit");
const { signIn } = await import("@/app/(auth)/actions");

const keys = () => consumeRateLimit.mock.calls.map(([key]) => key);

describe("tooManyAttempts", () => {
  beforeEach(() => vi.clearAllMocks());

  it("counts per IP and per account, never storing the email", async () => {
    expect(
      await tooManyAttempts("sign-in", {
        headers: requestHeaders,
        account: "Ada@Example.test",
      }),
    ).toBe(false);
    expect(keys()).toHaveLength(2);
    expect(keys()).toContain("sign-in:ip:203.0.113.7");
    const account = keys().find((k) => k.startsWith("sign-in:account:"));
    expect(account).toMatch(/^sign-in:account:[0-9a-f]{64}$/);
    expect(account).not.toContain("example");

    // Same account however the email is capitalised.
    consumeRateLimit.mockClear();
    await tooManyAttempts("sign-in", {
      headers: requestHeaders,
      account: "ada@example.test",
    });
    expect(keys()).toContain(account);
  });

  it("is over the limit when either counter is", async () => {
    consumeRateLimit.mockImplementation(async (key: string) =>
      key.includes(":ip:"),
    );
    expect(
      await tooManyAttempts("sign-in", {
        headers: requestHeaders,
        account: "ada@example.test",
      }),
    ).toBe(true);
    consumeRateLimit.mockImplementation(async () => true);
  });

  it("limits a password change per user only", async () => {
    await tooManyAttempts("change-password", {
      headers: requestHeaders,
      account: "user-1",
    });
    expect(keys()).toEqual([
      expect.stringMatching(/^change-password:account:/),
    ]);
  });
});

describe("signIn", () => {
  beforeEach(() => vi.clearAllMocks());

  const form = () => {
    const data = new FormData();
    data.set("email", "ada@example.test");
    data.set("password", "correct horse battery");
    return data;
  };

  it("refuses before checking the password when over the limit", async () => {
    consumeRateLimit.mockResolvedValueOnce(false);
    expect(await signIn({}, form())).toMatchObject({
      formError: TOO_MANY_ATTEMPTS,
    });
    expect(signInEmail).not.toHaveBeenCalled();
    expect(redirect).not.toHaveBeenCalled();
  });

  it("signs in when within the limit", async () => {
    await signIn({}, form());
    expect(signInEmail).toHaveBeenCalledOnce();
    expect(redirect).toHaveBeenCalledWith("/account");
  });
});
