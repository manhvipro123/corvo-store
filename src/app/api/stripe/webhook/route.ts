import type Stripe from "stripe";

import { isEventProcessed } from "@/db/orders";
import { transitionFor } from "@/lib/checkout";
import { syncCheckoutSession } from "@/lib/checkout-session";
import { revalidateStorefront } from "@/lib/storefront-cache";
import { stripe } from "@/lib/stripe";

const HANDLED = new Set([
  "checkout.session.completed",
  "checkout.session.async_payment_succeeded",
  "checkout.session.async_payment_failed",
  "checkout.session.expired",
]);

/**
 * Stripe webhook: the only thing that confirms a payment. The signature is
 * its authentication (no session, not behind the proxy). Duplicates are
 * skipped by event id, and order moves are conditional, so replays and
 * out-of-order deliveries change nothing.
 */
export async function POST(request: Request) {
  const secret = process.env.STRIPE_WEBHOOK_SECRET;
  if (!secret) {
    // Our misconfiguration, not a bad request: 5xx keeps Stripe retrying
    // until the secret is set, and the log says why.
    console.error("[stripe] STRIPE_WEBHOOK_SECRET is not set");
    return new Response("Webhook not configured", { status: 500 });
  }
  const signature = request.headers.get("stripe-signature");
  if (!signature) return new Response("Bad request", { status: 400 });

  let event: Stripe.Event;
  try {
    // The raw body: any re-serialisation breaks the signature.
    event = stripe.webhooks.constructEvent(
      await request.text(),
      signature,
      secret,
    );
  } catch {
    return new Response("Invalid signature", { status: 400 });
  }

  if (!HANDLED.has(event.type)) return new Response(null, { status: 200 });

  try {
    if (await isEventProcessed(event.id))
      return new Response(null, { status: 200 });

    const session = event.data.object as Stripe.Checkout.Session;
    const transition = transitionFor(event.type, session.payment_status);
    if (transition) {
      await syncCheckoutSession(session, transition, {
        id: event.id,
        type: event.type,
      });
      // Units came back: cached product pages show them on the next visit.
      if (transition.release) revalidateStorefront();
    }
  } catch (error) {
    // 5xx makes Stripe retry later, which is safe for the reasons above.
    console.error("[stripe] webhook failed", event.id, error);
    return new Response("Webhook handler failed", { status: 500 });
  }
  return new Response(null, { status: 200 });
}
