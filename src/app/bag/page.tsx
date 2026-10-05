import type { Metadata } from "next";
import { CircleAlert, Lock } from "lucide-react";

import { BagCountSync } from "@/components/bag/bag-count";
import { BagLine } from "@/components/bag/bag-line";
import { CheckoutButton } from "@/components/bag/checkout-button";
import { Container } from "@/components/ui/container";
import { TextLink } from "@/components/ui/text-link";
import { siteConfig } from "@/config/site";
import { loadBag } from "@/lib/bag-cookie";
import { RESERVATION_MINUTES } from "@/lib/checkout";
import { formatPrice } from "@/lib/format";
import { getSession } from "@/lib/session";

export const metadata: Metadata = {
  title: "Bag",
  robots: { index: false },
};

export default async function BagPage() {
  // Pages can't write cookies: this shows the bag checked against live
  // stock, and the next bag action stores that normalised version.
  const [{ bag }, session] = await Promise.all([loadBag(), getSession()]);
  const { lines, adjustments, subtotalCents, itemCount } = bag;
  const hasSoldOut = lines.some((line) => line.quantity === 0);

  return (
    <Container inset="tile" className="py-12 md:py-20">
      <BagCountSync count={itemCount} />
      <header className="mb-8 md:mb-12">
        <h1 className="text-title">Bag</h1>
        {lines.length > 0 && (
          <p className="text-body text-muted mt-2">
            {itemCount} {itemCount === 1 ? "item" : "items"}
          </p>
        )}
      </header>

      {adjustments.length > 0 && (
        <div
          role="status"
          className="border-foreground text-meta mb-8 flex max-w-2xl items-start gap-3 border px-4 py-3"
        >
          <CircleAlert
            className="mt-px size-4 shrink-0"
            strokeWidth={1.5}
            aria-hidden
          />
          <ul className="flex flex-col gap-1">
            {adjustments.map((message, i) => (
              <li key={i}>{message}</li>
            ))}
          </ul>
        </div>
      )}

      {lines.length === 0 ? (
        <div className="flex flex-col gap-6">
          <p className="text-body text-muted">Your bag is empty.</p>
          <ul className="flex flex-wrap gap-x-8 gap-y-3">
            {siteConfig.nav.map((item) => (
              <li key={item.href}>
                <TextLink variant="action" href={item.href}>
                  {item.label}
                </TextLink>
              </li>
            ))}
          </ul>
        </div>
      ) : (
        <div className="grid gap-10 lg:grid-cols-[minmax(0,1fr)_22rem] lg:gap-16">
          <ul aria-label="Items in your bag" className="border-border border-t">
            {lines.map((line, i) => (
              <BagLine key={line.product.id} line={line} eager={i < 3} />
            ))}
          </ul>

          <aside
            aria-labelledby="summary-heading"
            className="lg:top-header self-start lg:sticky lg:pt-6"
          >
            <h2 id="summary-heading" className="text-heading">
              Summary
            </h2>
            <dl className="border-border mt-6 border-y">
              <div className="flex justify-between gap-6 pt-4 pb-2">
                <dt className="text-meta text-muted">Items ({itemCount})</dt>
                <dd className="text-meta tabular-nums">
                  {formatPrice(subtotalCents)}
                </dd>
              </div>
              <div className="flex justify-between gap-6 pb-4">
                <dt className="text-meta text-muted">Shipping</dt>
                <dd className="text-meta">Complimentary</dd>
              </div>
              <div className="border-border flex justify-between gap-6 border-t py-4">
                <dt className="text-label">Total</dt>
                <dd className="text-body font-medium tabular-nums">
                  {formatPrice(subtotalCents)}
                </dd>
              </div>
            </dl>
            <div className="mt-6">
              <CheckoutButton disabled={hasSoldOut} />
            </div>
            <p className="text-meta text-muted mt-4 flex items-start gap-2">
              <Lock
                className="mt-px size-3.5 shrink-0"
                strokeWidth={1.5}
                aria-hidden
              />
              <span>
                {hasSoldOut
                  ? "Remove sold-out pieces to check out."
                  : session
                    ? `You'll pay securely on Stripe. Your pieces are held for ${RESERVATION_MINUTES} minutes while you do.`
                    : "You'll sign in, then pay securely on Stripe."}
              </span>
            </p>
          </aside>
        </div>
      )}
    </Container>
  );
}
