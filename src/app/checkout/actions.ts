"use server";

import { redirect } from "next/navigation";

import {
  cancelPendingCheckout,
  clearConfirmedCheckout,
} from "@/lib/checkout-session";
import { requireUser } from "@/lib/session";

/** "Return to bag" after cancelling on Stripe: releases the held stock now. */
export async function returnToBag() {
  const { user } = await requireUser("/checkout/cancelled");
  try {
    await cancelPendingCheckout(user.id);
  } catch (error) {
    // Stripe unreachable: the hold ends on its own (expiry webhook or sweep).
    console.error("[checkout] could not end the checkout", error);
  }
  // Outside try/catch: redirect() works by throwing.
  redirect("/bag");
}

/**
 * Called by the success page once the order shows as confirmed. Empties the
 * bag only if the webhook really confirmed this browser's order.
 */
export async function finishCheckout() {
  const { user } = await requireUser("/bag");
  return clearConfirmedCheckout(user.id);
}
