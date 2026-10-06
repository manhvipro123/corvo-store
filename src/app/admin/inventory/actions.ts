"use server";

import { refresh } from "next/cache";

import { SAVE_FAILED } from "@/app/admin/form-state";
import * as catalog from "@/db/catalog-admin";
import {
  type StockAdjustField,
  parseStockAdjustForm,
  parseStockForm,
} from "@/lib/admin-validation";
import { releaseStalePendingOrders } from "@/lib/checkout-session";
import { requireAdmin } from "@/lib/session";
import { revalidateStorefront } from "@/lib/storefront-cache";

export type StockFormState = {
  formError?: string;
  fieldError?: string;
  /** What was submitted, kept in the field after an error. */
  quantity?: string;
  /** Announced after a successful save. */
  saved?: string;
};

/** Sets a product's available quantity (guarded by what the admin saw). */
export async function updateStock(
  _prev: StockFormState,
  data: FormData,
): Promise<StockFormState> {
  const { user } = await requireAdmin("/admin/inventory");

  const { values, errors, input, invalid } = parseStockForm(data);
  if (invalid) return { formError: SAVE_FAILED, ...values };
  if (!input) return { fieldError: errors.quantity, ...values };

  try {
    await catalog.setStock(input, user.id);
  } catch (error) {
    if (error instanceof catalog.StockChangedError) {
      // Re-render with the current numbers so the next save compares
      // against them; the typed value stays in the field.
      refresh();
      return {
        formError: `Stock changed to ${error.current} since this page loaded (a checkout may have reserved or returned units). Check it and save again.`,
        ...values,
      };
    }
    if (error instanceof catalog.NotFoundError)
      return { formError: "This product no longer exists.", ...values };
    console.error("[admin] stock update failed", error);
    return { formError: SAVE_FAILED, ...values };
  }

  revalidateStorefront();
  return {
    saved:
      input.quantity === 0
        ? "Saved: now sold out."
        : `Saved: ${input.quantity} available.`,
  };
}

export type StockAdjustState = {
  formError?: string;
  fieldErrors?: Partial<Record<StockAdjustField, string>>;
  values?: Partial<Record<StockAdjustField, string>>;
  saved?: string;
};

/** Adds received units or writes some off, with an optional note. */
export async function adjustStock(
  _prev: StockAdjustState,
  data: FormData,
): Promise<StockAdjustState> {
  const { user } = await requireAdmin("/admin/inventory");

  const { values, errors, input, invalid } = parseStockAdjustForm(data);
  if (invalid) return { formError: SAVE_FAILED, values };
  if (!input) return { fieldErrors: errors, values };

  try {
    await catalog.adjustStock({ ...input, actorUserId: user.id });
  } catch (error) {
    if (error instanceof catalog.InsufficientStockError)
      return {
        fieldErrors: {
          amount: `Only ${error.current} available, so at most ${error.current} can be removed.`,
        },
        values,
      };
    if (error instanceof catalog.StockLimitError)
      return {
        fieldErrors: {
          amount: `That would take stock above the maximum (now ${error.current}).`,
        },
        values,
      };
    if (error instanceof catalog.NotFoundError)
      return { formError: "This product no longer exists.", values };
    console.error("[admin] stock adjustment failed", error);
    return { formError: SAVE_FAILED, values };
  }

  revalidateStorefront();
  const units = Math.abs(input.delta);
  return {
    saved: `${input.delta > 0 ? "Added" : "Removed"} ${units} ${units === 1 ? "unit" : "units"}.`,
  };
}

export type ReleaseHoldsState = { message?: string; failed?: boolean };

/** Runs the stale-checkout sweep now (the same one the cron route runs). */
export async function releaseExpiredHolds(): Promise<ReleaseHoldsState> {
  await requireAdmin("/admin/inventory");

  try {
    const { released, skipped, needsReconcile } =
      await releaseStalePendingOrders();
    refresh();
    if (!released && !skipped && !needsReconcile)
      return { message: "No expired checkouts to release." };
    const notes = [
      skipped &&
        `${skipped} could not be released yet (Stripe hasn't confirmed they ended)`,
      needsReconcile &&
        `${needsReconcile} were completed at Stripe and need their webhook resent`,
    ].filter(Boolean);
    return {
      message: `Released ${released} expired ${released === 1 ? "checkout" : "checkouts"}${notes.length ? `; ${notes.join("; ")}` : ""}.`,
    };
  } catch (error) {
    console.error("[admin] releasing expired holds failed", error);
    return {
      message: "We couldn't release expired checkouts. Please try again.",
      failed: true,
    };
  }
}
