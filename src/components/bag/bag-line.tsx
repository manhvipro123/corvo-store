import Link from "next/link";

import { removeFromBag } from "@/app/bag/actions";
import { QuantityStepper } from "@/components/bag/quantity-stepper";
import { ProductImage } from "@/components/product/product-image";
import { StockStatus } from "@/components/product/stock-status";
import { MediaFrame } from "@/components/ui/media-frame";
import type { BagLine as Line } from "@/lib/bag";
import { colors } from "@/lib/colors";
import { formatPrice } from "@/lib/format";
import { cn } from "@/lib/utils";

/** One bag row: thumbnail, name and price, quantity, remove, line total. */
export function BagLine({
  line,
  eager = false,
}: {
  line: Line;
  /** Above the fold: load the thumbnail right away (LCP candidate). */
  eager?: boolean;
}) {
  const { product, quantity, totalCents } = line;
  const soldOut = product.stock <= 0;
  const href = `/products/${product.slug}`;
  const color = colors.find((c) => c.slug === product.color)?.label;

  return (
    <li className="border-border flex gap-4 border-b py-6 md:gap-6">
      <Link
        href={href}
        tabIndex={-1}
        aria-hidden
        className="w-24 shrink-0 md:w-32"
      >
        <MediaFrame>
          <ProductImage
            image={product.image}
            sizes="128px"
            loading={eager ? "eager" : undefined}
            className={cn(soldOut && "opacity-60")}
          />
        </MediaFrame>
      </Link>

      <div className="flex min-w-0 flex-1 flex-col gap-4">
        <div className="flex justify-between gap-4">
          <div className="flex min-w-0 flex-col gap-1">
            <Link
              href={href}
              className="text-meta font-medium underline-offset-2 hover:underline"
            >
              {product.name}
            </Link>
            <p className="text-meta text-muted">
              {[color, formatPrice(product.priceCents)]
                .filter(Boolean)
                .join(" · ")}
            </p>
          </div>
          <p
            className={cn(
              "text-meta shrink-0 font-medium tabular-nums",
              soldOut && "text-muted",
            )}
          >
            {soldOut ? "—" : formatPrice(totalCents)}
          </p>
        </div>

        <StockStatus stock={product.stock} />

        <div className="mt-auto flex items-center gap-6">
          {!soldOut && (
            <QuantityStepper
              productId={product.id}
              quantity={quantity}
              max={product.stock}
              name={product.name}
            />
          )}
          <form action={removeFromBag}>
            <input type="hidden" name="productId" value={product.id} />
            <button
              type="submit"
              aria-label={`Remove ${product.name} from bag`}
              className="text-label text-muted hover:text-foreground underline underline-offset-4 transition-colors"
            >
              Remove
            </button>
          </form>
        </div>
      </div>
    </li>
  );
}
