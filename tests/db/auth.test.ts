import { neon } from "@neondatabase/serverless";
import { afterAll, beforeAll, describe, expect, it } from "vitest";

import { grantAdmin } from "@/db/grant-admin";
import { isAdmin } from "@/lib/auth-redirect";

const url = process.env.TEST_DATABASE_URL;

describe.skipIf(!url)("auth flows (test database)", () => {
  // Loaded in a hook: describe callbacks run even when skipped, and the
  // auth module imports the DB client, which needs a database URL.
  let auth: (typeof import("@/lib/auth"))["auth"];
  const sql = neon(url ?? "postgresql://skipped@localhost/none");
  const run = crypto.randomUUID().slice(0, 8);
  const email = `customer-${run}@example.test`;
  const password = "correct horse battery";

  beforeAll(async () => {
    ({ auth } = await import("@/lib/auth"));
  });

  afterAll(async () => {
    if (url)
      await sql`delete from users where email like ${`%-${run}@example.test`}`;
  });

  /** Signs in and returns the session cookie header for later requests. */
  async function signInCookie(e = email, p = password) {
    const res = await auth.api.signInEmail({
      body: { email: e, password: p },
      asResponse: true,
    });
    expect(res.status).toBe(200);
    const cookie = res.headers.getSetCookie().map((c) => c.split(";")[0]);
    expect(cookie.length).toBeGreaterThan(0);
    return cookie.join("; ");
  }

  it("signs up a customer with the default role and a hashed password", async () => {
    const { user } = await auth.api.signUpEmail({
      body: { name: "Test Customer", email, password },
    });
    expect(user.email).toBe(email);

    const [row] = await sql`select role from users where id = ${user.id}`;
    expect(row.role).toBe("user");

    const [account] =
      await sql`select provider_id, password from accounts where user_id = ${user.id}`;
    expect(account.provider_id).toBe("credential");
    expect(account.password).not.toContain(password);
  });

  it("refuses a role sent at sign-up and creates no user", async () => {
    const other = `sneaky-${run}@example.test`;
    await expect(
      auth.api.signUpEmail({
        // `role` is input: false in the admin plugin; it must not be settable.
        body: {
          name: "Sneaky",
          email: other,
          password,
          role: "admin",
        } as never,
      }),
    ).rejects.toThrow(/role is not allowed/);
    const rows = await sql`select 1 from users where email = ${other}`;
    expect(rows).toHaveLength(0);
  });

  it("rejects a duplicate email", async () => {
    await expect(
      auth.api.signUpEmail({ body: { name: "Again", email, password } }),
    ).rejects.toMatchObject({
      body: { code: expect.stringMatching(/^USER_ALREADY_EXISTS/) },
    });
  });

  it("rejects a wrong password", async () => {
    const res = await auth.api.signInEmail({
      body: { email, password: "wrong password" },
      asResponse: true,
    });
    expect(res.status).toBe(401);
  });

  it("restores the session from the cookie, then ends it on sign-out", async () => {
    const cookie = await signInCookie();
    const headers = new Headers({ cookie });

    const session = await auth.api.getSession({ headers });
    expect(session?.user.email).toBe(email);
    expect(session?.session.expiresAt.getTime()).toBeGreaterThan(
      Date.now() + 29 * 24 * 60 * 60 * 1000, // ~30-day persistent session
    );

    await auth.api.signOut({ headers });
    expect(await auth.api.getSession({ headers })).toBeNull();
  });

  it("updates the customer's name but never their role", async () => {
    const headers = new Headers({ cookie: await signInCookie() });
    await auth.api.updateUser({ body: { name: "Renamed Customer" }, headers });
    await expect(
      auth.api.updateUser({ body: { role: "admin" } as never, headers }),
    ).rejects.toThrow(/role is not allowed/);

    const session = await auth.api.getSession({ headers });
    expect(session?.user.name).toBe("Renamed Customer");
    expect(isAdmin(session?.user.role)).toBe(false);
  });

  it("changes the password and signs out other sessions", async () => {
    const other = new Headers({ cookie: await signInCookie() });
    const current = new Headers({ cookie: await signInCookie() });
    const newPassword = "another horse battery";

    await expect(
      auth.api.changePassword({
        body: { currentPassword: "wrong password", newPassword },
        headers: current,
      }),
    ).rejects.toMatchObject({ body: { code: "INVALID_PASSWORD" } });

    // Same calls as the changePassword Server Action.
    await auth.api.changePassword({
      body: { currentPassword: password, newPassword },
      headers: current,
    });
    await auth.api.revokeOtherSessions({ headers: current });
    expect(await auth.api.getSession({ headers: current })).not.toBeNull();
    expect(await auth.api.getSession({ headers: other })).toBeNull();

    const old = await auth.api.signInEmail({
      body: { email, password },
      asResponse: true,
    });
    expect(old.status).toBe(401);
    await signInCookie(email, newPassword);

    // Restore so later tests can sign in with the original password.
    await auth.api.changePassword({
      body: { currentPassword: newPassword, newPassword: password },
      headers: new Headers({ cookie: await signInCookie(email, newPassword) }),
    });
  });

  it("grants the admin role to an existing user", async () => {
    await grantAdmin(url!, email.toUpperCase());
    const session = await auth.api.getSession({
      headers: new Headers({ cookie: await signInCookie() }),
    });
    expect(isAdmin(session?.user.role)).toBe(true);
    await expect(
      grantAdmin(url!, `nobody-${run}@example.test`),
    ).rejects.toThrow();
  });
});
