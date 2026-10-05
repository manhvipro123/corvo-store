"use client";

import { CircleAlert, LoaderCircle } from "lucide-react";
import { useActionState } from "react";

import { type CheckoutState, startCheckout } from "@/app/bag/actions";
import { Button } from "@/components/ui/button";

/** Posts nothing but the intent: the action rebuilds the order server-side. */
export function CheckoutButton({ disabled }: { disabled: boolean }) {
  const [state, formAction, pending] = useActionState<CheckoutState>(
    startCheckout,
    {},
  );

  return (
    <form action={formAction} className="flex flex-col gap-3">
      <Button type="submit" fullWidth disabled={disabled || pending}>
        {pending && (
          <LoaderCircle
            className="size-4 animate-spin"
            strokeWidth={1.5}
            aria-hidden
          />
        )}
        {pending ? "Reserving your pieces…" : "Checkout"}
      </Button>
      <p role="alert" className="text-meta flex items-start gap-2 empty:hidden">
        {!pending && state.message && (
          <>
            <CircleAlert
              className="mt-px size-3.5 shrink-0"
              strokeWidth={1.5}
              aria-hidden
            />
            <span>{state.message}</span>
          </>
        )}
      </p>
    </form>
  );
}
