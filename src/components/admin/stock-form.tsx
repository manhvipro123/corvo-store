"use client";

import { Check, CircleAlert, LoaderCircle } from "lucide-react";
import { useActionState } from "react";

import { updateStock } from "@/app/admin/inventory/actions";
import { Button } from "@/components/ui/button";
import { inputClass } from "@/components/ui/field";
import { STOCK_MAX } from "@/lib/admin-validation";

/**
 * Inline "set available quantity" form (inventory rows and the product
 * page), with a one-click "Mark sold out". In stock / low / sold out is
 * derived from the quantity, never stored. Sends the quantity it was
 * rendered with as `expected`, so the save is refused if a checkout
 * reserved units in the meantime.
 */
export function StockForm({
  productId,
  productName,
  available,
}: {
  productId: number;
  productName: string;
  available: number;
}) {
  const [state, formAction, pending] = useActionState(updateStock, {});
  const id = `stock-${productId}`;
  const message = state.fieldError ?? state.formError;

  return (
    <form action={formAction} noValidate className="flex flex-col gap-2">
      <input type="hidden" name="productId" value={productId} />
      {/* Controlled: follows the latest render, also after a refused save. */}
      <input type="hidden" name="expected" value={available} />
      <div className="flex items-end gap-3">
        <label htmlFor={id} className="sr-only">
          Available units of {productName}
        </label>
        <input
          id={id}
          name="quantity"
          type="number"
          min={0}
          max={STOCK_MAX}
          step={1}
          inputMode="numeric"
          required
          disabled={pending}
          // Remount when the server value changes so the field shows it.
          key={available}
          defaultValue={state.fieldError ? state.quantity : available}
          aria-invalid={Boolean(state.fieldError)}
          aria-describedby={message ? `${id}-message` : undefined}
          className={inputClass(state.fieldError, "h-10 w-24 tabular-nums")}
        />
        <Button type="submit" size="sm" variant="secondary" disabled={pending}>
          {pending && (
            <LoaderCircle
              className="size-4 animate-spin"
              strokeWidth={1.5}
              aria-hidden
            />
          )}
          {pending ? "Saving" : "Save"}
        </Button>
        {available > 0 && (
          // Submits with `intent=sold-out`; the server sets the quantity to 0.
          <button
            type="submit"
            name="intent"
            value="sold-out"
            disabled={pending}
            className="text-label text-muted hover:text-foreground h-10 underline underline-offset-4 transition-colors disabled:opacity-40"
          >
            Mark sold out
          </button>
        )}
      </div>
      <p
        id={`${id}-message`}
        role={message ? "alert" : "status"}
        className="text-meta flex max-w-xs items-start gap-2"
      >
        {message ? (
          <>
            <CircleAlert
              className="mt-px size-3.5 shrink-0"
              strokeWidth={1.5}
              aria-hidden
            />
            {message}
          </>
        ) : (
          state.saved && (
            <>
              <Check className="size-3.5" strokeWidth={2} aria-hidden />
              Saved
            </>
          )
        )}
      </p>
    </form>
  );
}
