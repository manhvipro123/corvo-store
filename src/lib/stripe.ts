import "server-only";

import Stripe from "stripe";

/**
 * Server-side Stripe client. Use a restricted key (`rk_…`) with write access
 * to Checkout Sessions only. The placeholder lets `next build` run without
 * Stripe configured; any real API call then fails loudly.
 */
export const stripe = new Stripe(
  process.env.STRIPE_SECRET_KEY || "stripe_key_not_configured",
  { apiVersion: "2026-09-30.endive" },
);

/** Absolute base URL for Stripe's success/cancel redirects. */
export function siteURL() {
  const url = process.env.NEXT_PUBLIC_SITE_URL;
  if (!url) throw new Error("NEXT_PUBLIC_SITE_URL is not set.");
  return url.replace(/\/$/, "");
}
