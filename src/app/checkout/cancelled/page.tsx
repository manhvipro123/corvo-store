import type { Metadata } from "next";

import { returnToBag } from "@/app/checkout/actions";
import { SubmitButton } from "@/components/checkout/submit-button";
import { Container } from "@/components/ui/container";
import { TextLink } from "@/components/ui/text-link";
import { loadBag } from "@/lib/bag-cookie";
import { RESERVATION_MINUTES } from "@/lib/checkout";
import { formatPrice } from "@/lib/format";
import { requireUser } from "@/lib/session";

export const metadata: Metadata = {
  title: "Checkout cancelled",
  robots: { index: false },
};

/** Stripe's cancel_url: nothing was charged and the bag is untouched. */
export default async function CheckoutCancelledPage() {
  await requireUser("/checkout/cancelled");
  const { bag } = await loadBag();

  return (
    <Container inset="tile" className="py-12 md:py-20">
      <div className="max-w-md">
        <h1 className="text-title">Checkout cancelled</h1>
        <p className="text-body text-muted mt-2">
          You haven&apos;t been charged. We&apos;re holding your pieces for up
          to {RESERVATION_MINUTES} minutes in case you change your mind.
        </p>

        {bag.lines.length > 0 && (
          <dl className="border-border mt-10 border-y">
            <div className="flex justify-between gap-6 py-4">
              <dt className="text-label">
                Your bag ({bag.itemCount}{" "}
                {bag.itemCount === 1 ? "item" : "items"})
              </dt>
              <dd className="text-body font-medium tabular-nums">
                {formatPrice(bag.subtotalCents)}
              </dd>
            </div>
          </dl>
        )}

        <form action={returnToBag} className="mt-10">
          <SubmitButton pendingLabel="Releasing your pieces…">
            Return to bag
          </SubmitButton>
        </form>
        <p className="text-meta text-muted mt-4">
          Returning to your bag releases the held pieces so others can buy them.
          To try again, check out from your bag.
        </p>
        <TextLink
          variant="action"
          href="/products"
          className="mt-8 inline-block"
        >
          Continue shopping
        </TextLink>
      </div>
    </Container>
  );
}
