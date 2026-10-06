import "server-only";

import { revalidatePath } from "next/cache";

/**
 * After a catalog edit: drops every cached page (including the 60s ISR
 * ones: `/`, `/products/[slug]`, `/new-arrivals`, `/categories`) so the
 * change shows at once instead of within a minute. Server Actions only.
 */
export function revalidateStorefront() {
  revalidatePath("/", "layout");
}
