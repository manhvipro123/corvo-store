/** Where people land after signing in when no safe destination is given. */
export const DEFAULT_AFTER_AUTH = "/account";

/**
 * Returns `value` only if it is a same-site path ("/account", "/x?y=1");
 * anything else (absolute URLs, protocol-relative "//host", "/\host",
 * empty) falls back to the account page. Prevents open redirects through
 * the `callbackURL` parameter.
 */
export function safeCallbackURL(value: unknown): string {
  if (typeof value !== "string") return DEFAULT_AFTER_AUTH;
  const path = value.trim();
  if (!path.startsWith("/") || path.startsWith("//") || path.startsWith("/\\"))
    return DEFAULT_AFTER_AUTH;
  return path;
}

/** Sign-in URL that returns to `path` afterwards. */
export function signInHref(path: string) {
  return `/sign-in?callbackURL=${encodeURIComponent(safeCallbackURL(path))}`;
}

/** True when the comma-separated Better Auth `role` includes "admin". */
export function isAdmin(role: string | null | undefined) {
  return (role ?? "")
    .split(",")
    .map((r) => r.trim())
    .includes("admin");
}
