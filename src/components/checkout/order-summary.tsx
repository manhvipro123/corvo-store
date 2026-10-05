import Link from "next/link";

import { ProductImage } from "@/components/product/product-image";
import { MediaFrame } from "@/components/ui/media-frame";
import { formatPrice } from "@/lib/format";
import type { Order } from "@/types/catalog";

/**
 * Order lines (snapshot name, SKU and unit price as charged), quantities and
 * totals as stored on our side.
 */
export function OrderSummary({ order }: { order: Order }) {
  const address = order.shipping?.address;
  const itemCount = order.lines.reduce((sum, l) => sum + l.quantity, 0);

  return (
    <section aria-labelledby="order-summary-heading">
      <h2 id="order-summary-heading" className="sr-only">
        Order summary
      </h2>
      <ul className="border-border border-t">
        {order.lines.map((line) => (
          <li
            key={line.productId}
            className="border-border flex gap-4 border-b py-6"
          >
            <Link
              href={`/products/${line.slug}`}
              tabIndex={-1}
              aria-hidden
              className="w-20 shrink-0"
            >
              <MediaFrame>
                <ProductImage
                  image={line.image}
                  sizes="80px"
                  // Small and few per order: load all now, so a later
                  // cover-cropped shot can't become a lazy LCP.
                  loading="eager"
                />
              </MediaFrame>
            </Link>
            <div className="flex min-w-0 flex-1 justify-between gap-4">
              <div className="flex flex-col gap-1">
                <Link
                  href={`/products/${line.slug}`}
                  className="text-meta font-medium underline-offset-2 hover:underline"
                >
                  {line.name}
                </Link>
                <p className="text-meta text-muted">Style {line.sku}</p>
                <dl className="text-meta text-muted mt-1 flex flex-wrap gap-x-4 gap-y-1">
                  <div className="flex gap-1">
                    <dt>Unit price</dt>
                    <dd className="text-foreground tabular-nums">
                      {formatPrice(line.unitPriceCents)}
                    </dd>
                  </div>
                  <div className="flex gap-1">
                    <dt>Qty</dt>
                    <dd className="text-foreground tabular-nums">
                      {line.quantity}
                    </dd>
                  </div>
                </dl>
              </div>
              <p className="text-meta shrink-0 font-medium tabular-nums">
                <span className="sr-only">Line total </span>
                {formatPrice(line.unitPriceCents * line.quantity)}
              </p>
            </div>
          </li>
        ))}
      </ul>

      <dl className="border-border border-b">
        <div className="flex justify-between gap-6 pt-4 pb-2">
          <dt className="text-meta text-muted">Items ({itemCount})</dt>
          <dd className="text-meta tabular-nums">
            {formatPrice(order.subtotalCents)}
          </dd>
        </div>
        <div className="flex justify-between gap-6 pb-4">
          <dt className="text-meta text-muted">Shipping</dt>
          <dd className="text-meta">Complimentary</dd>
        </div>
        <div className="border-border flex justify-between gap-6 border-t py-4">
          <dt className="text-label">Total</dt>
          <dd className="text-body font-medium tabular-nums">
            {formatPrice(order.totalCents ?? order.subtotalCents)}
          </dd>
        </div>
        {order.shipping && address && (
          <div className="border-border flex justify-between gap-6 border-t py-4">
            <dt className="text-label shrink-0">Ship to</dt>
            <dd className="text-meta text-muted text-right">
              {[
                order.shipping.name,
                address.line1,
                address.line2,
                [address.city, address.state, address.postal_code]
                  .filter(Boolean)
                  .join(" "),
              ]
                .filter(Boolean)
                .map((part) => (
                  <span key={part} className="block">
                    {part}
                  </span>
                ))}
            </dd>
          </div>
        )}
      </dl>
    </section>
  );
}
