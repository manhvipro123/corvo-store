"use server";

import { refresh } from "next/cache";

import { SAVE_FAILED } from "@/app/admin/form-state";
import * as catalog from "@/db/catalog-admin";
import { parseStockForm } from "@/lib/admin-validation";
import { requireAdmin } from "@/lib/session";
import { revalidateStorefront } from "@/lib/storefront-cache";

export type StockFormState = {
  formError?: string;
  fieldError?: string;
  quantity?: string;
  saved?: boolean;
};

export async function updateStock(
  _prev: StockFormState,
  data: FormData,
): Promise<StockFormState> {
  await requireAdmin("/admin/inventory");

  const { values, errors, input, invalid } = parseStockForm(data);
  if (invalid) return { formError: SAVE_FAILED, ...values };
  if (!input) return { fieldError: errors.quantity, ...values };

  try {
    await catalog.setStock(input);
  } catch (error) {
    if (error instanceof catalog.StockChangedError) {
      // Re-render with the current numbers so the next save compares
      // against them.
      refresh();
      return {
        formError: `Stock changed to ${error.current} since this page loaded (a checkout may have reserved units). Check it and save again.`,
        ...values,
      };
    }
    if (error instanceof catalog.NotFoundError)
      return { formError: "This product no longer exists.", ...values };
    console.error("[admin] stock update failed", error);
    return { formError: SAVE_FAILED, ...values };
  }

  revalidateStorefront();
  return { saved: true, ...values };
}
