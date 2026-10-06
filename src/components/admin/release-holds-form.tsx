"use client";

import { Check, CircleAlert, LoaderCircle } from "lucide-react";
import { useActionState } from "react";

import {
  type ReleaseHoldsState,
  releaseExpiredHolds,
} from "@/app/admin/inventory/actions";
import { Button } from "@/components/ui/button";

/**
 * Banner with "Release expired holds" (runs the cron's sweep now). Always
 * mounted, even with nothing to release: a successful run re-renders the
 * page with `staleCheckouts = 0`, and the result must survive that.
 * Checkouts the sweep flagged (`needsReconcile`) get their own notice: only
 * a resent Stripe webhook can settle them.
 */
export function ReleaseHoldsForm({
  staleCheckouts,
  needsReconcile,
}: {
  staleCheckouts: number;
  needsReconcile: number;
}) {
  const [state, formAction, pending] = useActionState<ReleaseHoldsState>(
    releaseExpiredHolds,
    {},
  );
  const result = (
    <>
      <p role="alert" className="text-meta flex items-start gap-2">
        {state.failed && (
          <>
            <CircleAlert
              className="mt-px size-3.5 shrink-0"
              strokeWidth={1.5}
              aria-hidden
            />
            {state.message}
          </>
        )}
      </p>
      <p role="status" className="text-meta flex items-center gap-2">
        {state.message && !state.failed && (
          <>
            <Check className="size-3.5" strokeWidth={2} aria-hidden />
            {state.message}
          </>
        )}
      </p>
    </>
  );

  const reconcileNotice = needsReconcile > 0 && (
    <div className="border-border mb-8 border px-4 py-4">
      <p className="text-meta max-w-prose">
        {needsReconcile}{" "}
        {needsReconcile === 1 ? "checkout was" : "checkouts were"} completed at
        Stripe, but the payment webhook never arrived, so{" "}
        {needsReconcile === 1 ? "it is" : "they are"} still holding stock.
        Resend the checkout events from the Stripe Dashboard to settle{" "}
        {needsReconcile === 1 ? "it" : "them"}.
      </p>
    </div>
  );

  if (staleCheckouts === 0)
    return (
      <>
        {reconcileNotice}
        <div className={state.message ? "mb-6" : undefined}>{result}</div>
      </>
    );

  return (
    <>
      {reconcileNotice}
      <div className="border-border mb-8 flex flex-col gap-4 border px-4 py-4 sm:flex-row sm:items-start sm:justify-between">
        <p className="text-meta max-w-prose">
          {staleCheckouts} expired{" "}
          {staleCheckouts === 1 ? "checkout is" : "checkouts are"} still holding
          stock. They are released automatically by the scheduled sweep, or now:
        </p>
        <form action={formAction} className="flex flex-col items-start gap-3">
          <Button
            type="submit"
            size="sm"
            variant="secondary"
            disabled={pending}
          >
            {pending && (
              <LoaderCircle
                className="size-4 animate-spin"
                strokeWidth={1.5}
                aria-hidden
              />
            )}
            {pending ? "Releasing…" : "Release expired holds"}
          </Button>
          {result}
        </form>
      </div>
    </>
  );
}
