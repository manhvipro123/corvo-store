import Link from "next/link";
import { ChevronDown } from "lucide-react";

import { Button } from "@/components/ui/button";
import { StockStatus } from "@/components/product/stock-status";
import { categoryHref, getStockStatus } from "@/lib/catalog";
import { formatPrice } from "@/lib/format";
import type { Product } from "@/types/catalog";

const services = [
  {
    title: "Shipping and returns",
    body: "Complimentary express delivery on every order. Unworn pieces can be returned within 30 days at no cost.",
  },
  {
    title: "Signature packaging",
    body: "Every order arrives wrapped and ready to give, with a handwritten note on request.",
  },
];

/**
 * Info column: breadcrumb, name and price, purchase block, description and
 * details — grouped with consistent steps (8 / 10 / 8) rather than ad hoc gaps.
 */
export function ProductDetails({ product }: { product: Product }) {
  const soldOut = getStockStatus(product.stock) === "sold-out";

  return (
    <div className="flex flex-col">
      <nav aria-label="Breadcrumb" className="text-meta text-muted">
        <ol className="flex items-center gap-2">
          <li>
            <Link href="/products" className="hover:text-foreground">
              Shop all
            </Link>
          </li>
          <li aria-hidden>/</li>
          <li>
            <Link
              href={categoryHref(product.category)}
              className="hover:text-foreground"
            >
              {product.categoryName}
            </Link>
          </li>
        </ol>
      </nav>

      <div className="mt-4 flex flex-col gap-2 md:mt-6">
        <h1 className="text-title">{product.name}</h1>
        <p className="text-body font-medium">
          {formatPrice(product.priceCents)}
        </p>
      </div>

      <div className="mt-8 flex flex-col gap-3">
        <StockStatus stock={product.stock} />
        {/* Cart isn't built yet; the button establishes the layout and states. */}
        <Button fullWidth disabled={soldOut}>
          {soldOut ? "Sold out" : "Add to bag"}
        </Button>
        {!soldOut && (
          <p className="text-meta text-muted">
            Complimentary express shipping and returns.
          </p>
        )}
      </div>

      <p className="text-body text-muted mt-10">{product.description}</p>

      <div className="border-border mt-8 border-t">
        <Disclosure title="Details" defaultOpen>
          <ul className="flex flex-col gap-1">
            {product.details.map((detail) => (
              <li key={detail}>{detail}</li>
            ))}
          </ul>
          <p className="mt-3">Style {product.sku}</p>
        </Disclosure>
        {services.map((service) => (
          <Disclosure key={service.title} title={service.title}>
            <p>{service.body}</p>
          </Disclosure>
        ))}
      </div>
    </div>
  );
}

/** Hairline-ruled expandable row built on native <details>. */
function Disclosure({
  title,
  defaultOpen = false,
  children,
}: {
  title: string;
  defaultOpen?: boolean;
  children: React.ReactNode;
}) {
  return (
    <details open={defaultOpen} className="group border-border border-b">
      <summary className="text-label flex cursor-pointer list-none items-center justify-between py-5 [&::-webkit-details-marker]:hidden">
        {title}
        <ChevronDown
          className="size-4 transition-transform duration-200 group-open:rotate-180"
          strokeWidth={1.5}
          aria-hidden
        />
      </summary>
      <div className="text-meta text-muted pb-6">{children}</div>
    </details>
  );
}
