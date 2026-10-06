"use client";

import { Check, CircleAlert, LoaderCircle } from "lucide-react";
import { useActionState, useEffect } from "react";

import { type AddToBagState, addToBag } from "@/app/bag/actions";
import { notifyBagChange } from "@/components/bag/bag-count";
import { Button } from "@/components/ui/button";
import { TextLink } from "@/components/ui/text-link";

/**
 * Adds one piece to the bag. `soldOut` comes from the (up to a minute old)
 * cached page; the action re-checks live stock either way.
 */
export function AddToBag({
  productId,
  soldOut,
}: {
  productId: number;
  soldOut: boolean;
}) {
  const [state, formAction, pending] = useActionState<AddToBagState, FormData>(
    addToBag,
    {},
  );

  // The action may have changed the count cookie, whatever it returned.
  useEffect(() => {
    if (state.added || state.message) notifyBagChange();
  }, [state]);

  return (
    <form action={formAction} className="flex flex-col gap-3">
      <input type="hidden" name="productId" value={productId} />
      <Button type="submit" fullWidth disabled={soldOut || pending}>
        {pending && (
          <LoaderCircle
            className="size-4 animate-spin"
            strokeWidth={1.5}
            aria-hidden
          />
        )}
        {soldOut ? "Sold out" : pending ? "Adding…" : "Add to bag"}
      </Button>
      <p
        role="status"
        className="text-meta flex items-start gap-2 empty:hidden"
      >
        {!pending && state.added && (
          <>
            <Check
              className="mt-px size-3.5 shrink-0"
              strokeWidth={2}
              aria-hidden
            />
            <span>
              Added to your bag.{" "}
              <TextLink variant="inline" href="/bag">
                View bag
              </TextLink>
            </span>
          </>
        )}
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
