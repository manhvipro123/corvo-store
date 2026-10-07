"use client";

import { LoaderCircle } from "lucide-react";
import { useActionState, useState } from "react";

import {
  type StockAdjustState,
  adjustStock,
} from "@/app/admin/inventory/actions";
import { Button } from "@/components/ui/button";
import {
  Field,
  FormError,
  FormStatus,
  fieldProps,
  inputClass,
} from "@/components/ui/field";
import {
  STOCK_MAX,
  STOCK_NOTE_MAX_LENGTH,
  type StockAdjustField,
  parseStockAdjustForm,
} from "@/lib/admin-validation";

/**
 * Adds received units or writes some off. Unlike setting a quantity, an
 * adjustment can't overwrite a concurrent checkout, so it needs no
 * "expected" value. Recorded in the stock history with its note.
 */
export function StockAdjustForm({ productId }: { productId: number }) {
  const [state, formAction, pending] = useActionState<
    StockAdjustState,
    FormData
  >(adjustStock, {});
  const [clientErrors, setClientErrors] =
    useState<Partial<Record<StockAdjustField, string>>>();
  const errors = clientErrors ?? state.fieldErrors ?? {};
  const values = state.values ?? {};

  function onSubmit(event: React.FormEvent<HTMLFormElement>) {
    const { errors } = parseStockAdjustForm(new FormData(event.currentTarget));
    const invalid = Object.keys(errors).length > 0;
    setClientErrors(invalid ? errors : undefined);
    if (invalid) event.preventDefault();
  }

  return (
    <form
      action={formAction}
      onSubmit={onSubmit}
      noValidate
      aria-busy={pending}
      className="flex flex-col gap-6"
    >
      <input type="hidden" name="productId" value={productId} />
      <FormError message={state.formError} />
      <fieldset
        disabled={pending}
        className="grid gap-6 sm:grid-cols-[12rem_8rem_minmax(0,1fr)]"
      >
        <legend className="sr-only">Adjust stock</legend>
        <Field id="direction" label="Change">
          <select
            id="direction"
            name="direction"
            key={values.direction}
            defaultValue={values.direction === "out" ? "out" : "in"}
            className={inputClass(undefined, "bg-background h-12")}
          >
            <option value="in">Add received units</option>
            <option value="out">Remove (write off)</option>
          </select>
        </Field>
        <Field id="amount" label="Units" error={errors.amount}>
          <input
            {...fieldProps("amount", errors.amount)}
            key={values.amount}
            type="number"
            min={1}
            max={STOCK_MAX}
            step={1}
            inputMode="numeric"
            defaultValue={values.amount}
            className={inputClass(errors.amount, "h-12 tabular-nums")}
          />
        </Field>
        <Field
          id="note"
          label="Note (optional)"
          hint="Shown in the stock history, e.g. “Delivery 1042” or “Damaged”."
          error={errors.note}
        >
          <input
            {...fieldProps("note", errors.note, true)}
            key={values.note}
            type="text"
            maxLength={STOCK_NOTE_MAX_LENGTH}
            defaultValue={values.note}
            className={inputClass(errors.note, "h-12")}
          />
        </Field>
      </fieldset>
      <div className="flex flex-col items-start gap-4 sm:flex-row sm:items-center">
        <Button
          type="submit"
          variant="secondary"
          disabled={pending}
          className="w-full sm:w-auto"
        >
          {pending && (
            <LoaderCircle
              className="size-4 animate-spin"
              strokeWidth={1.5}
              aria-hidden
            />
          )}
          {pending ? "Applying…" : "Apply change"}
        </Button>
        <FormStatus show={Boolean(state.saved)} message={state.saved ?? ""} />
      </div>
    </form>
  );
}
