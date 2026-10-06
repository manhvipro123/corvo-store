import "server-only";

import { revalidatePath } from "next/cache";

/**
 * After a catalog edit: drops every cached page (including the 60s ISR
 * ones: `/`, `/products/[slug]`, `/new-arrivals`, `/categories`) so the
 * change shows at once instead of within a minute. Call it from Server
 * Actions or Route Handlers (the webhook and cron routes), not while
 * rendering.
 */
export function revalidateStorefront() {
  revalidatePath("/", "layout");
}
