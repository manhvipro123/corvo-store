"use client";

import { Check, CircleAlert, LoaderCircle } from "lucide-react";
import { useActionState, useEffect, useState } from "react";

import { updateStock } from "@/app/admin/inventory/actions";
import { useAnnounce } from "@/components/admin/inventory-status";
import { Button } from "@/components/ui/button";
import { inputClass } from "@/components/ui/field";
import { parseStockForm, stockFormMax } from "@/lib/admin-validation";

/**
 * Inline "set available quantity" form (inventory rows and the product
 * page), with a one-click "Mark sold out" (sets 0). In stock / low / sold
 * out is derived from the quantity, never stored. Sends the quantity it was
 * rendered with as `expected`, so the save is refused if a checkout
 * reserved or returned units in the meantime; the typed value is kept.
 */
export function StockForm({
  productId,
  productName,
  available,
  onHold,
}: {
  productId: number;
  productName: string;
  available: number;
  /** Units in open checkouts, which may come back after "sold out". */
  onHold: number;
}) {
  const [state, formAction, pending] = useActionState(updateStock, {});
  const [clientError, setClientError] = useState<string>();
  const announce = useAnnounce();
  const id = `stock-${productId}`;
  const error = clientError ?? state.fieldError ?? state.formError;
  const fieldError = clientError ?? state.fieldError;

  useEffect(() => {
    if (state.saved) announce?.(`${productName}: ${state.saved}`);
  }, [state, announce, productName]);

  function onSubmit(event: React.FormEvent<HTMLFormElement>) {
    const submitter = (event.nativeEvent as SubmitEvent).submitter;
    const { errors } = parseStockForm(
      new FormData(event.currentTarget, submitter),
    );
    setClientError(errors.quantity);
    if (errors.quantity) event.preventDefault();
  }

  return (
    <form
      action={formAction}
      onSubmit={onSubmit}
      noValidate
      className="flex flex-col gap-2"
    >
      <input type="hidden" name="productId" value={productId} />
      {/* Controlled: follows the latest render, also after a refused save. */}
      <input type="hidden" name="expected" value={available} />
      <div className="flex flex-wrap items-end gap-3">
        <label htmlFor={id} className="sr-only">
          Available units of {productName}
        </label>
        <input
          // Remount when the server value changes so the field shows it,
          // unless the save was refused: then keep what the admin typed.
          key={available}
          id={id}
          name="quantity"
          type="number"
          min={0}
          max={stockFormMax(available)}
          step={1}
          inputMode="numeric"
          disabled={pending}
          defaultValue={error ? state.quantity : available}
          aria-invalid={Boolean(fieldError)}
          aria-describedby={`${id}-error`}
          className={inputClass(fieldError, "h-10 w-24 tabular-nums")}
        />
        <Button type="submit" size="sm" variant="secondary" disabled={pending}>
          {pending && (
            <LoaderCircle
              className="size-4 animate-spin"
              strokeWidth={1.5}
              aria-hidden
            />
          )}
          {pending ? "Saving…" : "Save"}
          <span className="sr-only"> stock for {productName}</span>
        </Button>
        {available > 0 && (
          // Submits `intent=sold-out`; the server sets the quantity to 0.
          <button
            type="submit"
            name="intent"
            value="sold-out"
            disabled={pending}
            aria-describedby={onHold > 0 ? `${id}-on-hold` : undefined}
            className="text-label text-muted hover:text-foreground h-10 underline underline-offset-4 transition-colors disabled:opacity-40"
          >
            Mark <span className="sr-only">{productName} </span>sold out
          </button>
        )}
      </div>
      {available > 0 && onHold > 0 && (
        <p id={`${id}-on-hold`} className="text-meta text-muted max-w-xs">
          {onHold} {onHold === 1 ? "unit" : "units"} in open checkouts may come
          back if those checkouts end unpaid.
        </p>
      )}
      {/* Separate, always-present live regions: a region whose role
          changes is often missed by screen readers. */}
      <p
        id={`${id}-error`}
        role="alert"
        className="text-meta flex max-w-xs items-start gap-2"
      >
        {error && (
          <>
            <CircleAlert
              className="mt-px size-3.5 shrink-0"
              strokeWidth={1.5}
              aria-hidden
            />
            {error}
          </>
        )}
      </p>
      {/* On the inventory list the page-level region announces saves. */}
      {!announce && (
        <p role="status" className="text-meta flex items-center gap-2">
          {state.saved && !error && (
            <>
              <Check className="size-3.5" strokeWidth={2} aria-hidden />
              {state.saved}
            </>
          )}
        </p>
      )}
    </form>
  );
}
