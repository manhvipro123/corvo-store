/** Where people land after signing in when no safe destination is given. */
export const DEFAULT_AFTER_AUTH = "/account";

/** Placeholder origin for resolving paths; never requested. */
const PATH_BASE = "http://same.site";

/**
 * Returns `value` only if it is a same-site path ("/account", "/x?y=1");
 * anything else (absolute URLs, protocol-relative "//host", "/\host",
 * empty) falls back to the account page. Prevents open redirects through
 * the `callbackURL` parameter. The path is resolved the way a browser
 * resolves a redirect (it drops tabs and newlines and reads "\" as "/", so
 * "/\t/host" means "//host") and returned in that resolved form.
 */
export function safeCallbackURL(value: unknown): string {
  if (typeof value !== "string") return DEFAULT_AFTER_AUTH;
  const path = value.trim();
  if (!path.startsWith("/")) return DEFAULT_AFTER_AUTH;
  let url: URL;
  try {
    url = new URL(path, PATH_BASE);
  } catch {
    return DEFAULT_AFTER_AUTH;
  }
  // Dot segments can leave "//host" behind ("/.//host" → "//host"), which
  // would leave the site when used as a redirect.
  if (url.origin !== PATH_BASE || url.pathname.startsWith("//"))
    return DEFAULT_AFTER_AUTH;
  return url.pathname + url.search + url.hash;
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
