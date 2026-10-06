import "server-only";

import { headers } from "next/headers";
import { notFound, redirect } from "next/navigation";
import { cache } from "react";

import { auth } from "@/lib/auth";
import { isAdmin, signInHref } from "@/lib/auth-redirect";

/** The current session (or null), read from the DB once per request. */
export const getSession = cache(async () =>
  auth.api.getSession({ headers: await headers() }),
);

/**
 * Real access check for customer pages and actions: call it at the top of
 * every protected page/action (proxy.ts is only an optimistic redirect).
 */
export async function requireUser(returnTo: string) {
  const session = await getSession();
  if (!session) redirect(signInHref(returnTo));
  return session;
}

/** Like `requireUser`, and 404s for signed-in non-admins so admin routes stay hidden. */
export async function requireAdmin(returnTo: string) {
  const session = await requireUser(returnTo);
  if (!isAdmin(session.user.role)) notFound();
  return session;
}
