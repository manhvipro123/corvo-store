import Link from "next/link";

import { ProductImage } from "@/components/product/product-image";
import { MediaFrame } from "@/components/ui/media-frame";
import { getStockStatus } from "@/lib/catalog";
import { formatPrice } from "@/lib/format";
import { cn } from "@/lib/utils";
import type { Product } from "@/types/catalog";

export function ProductCard({
  product,
  sizes = "(min-width: 1024px) 25vw, 50vw",
  showCategory = true,
  eager = false,
}: {
  product: Product;
  /** First row of a page: load now, it's likely the LCP. */
  eager?: boolean;
  sizes?: string;
  /** Hide when the surrounding list is already scoped to one category. */
  showCategory?: boolean;
}) {
  const soldOut = getStockStatus(product.stock) === "sold-out";

  return (
    <Link href={`/products/${product.slug}`} className="group block">
      <MediaFrame>
        <ProductImage
          image={product.image}
          sizes={sizes}
          loading={eager ? "eager" : undefined}
          className={cn(
            "transition-transform duration-700 ease-out group-hover:scale-[1.03]",
            soldOut && "opacity-60",
          )}
        />
      </MediaFrame>
      {/* Keep in sync with the `tile` inset in ui/container.tsx. */}
      <div className="flex flex-col gap-1 px-4 pt-3 pb-8 md:px-6 md:pb-12">
        {showCategory && (
          <p className="text-meta text-muted">{product.categoryName}</p>
        )}
        <h3 className="text-meta line-clamp-2 underline-offset-2 group-hover:underline">
          {product.name}
        </h3>
        <p className="text-meta mt-1 flex gap-3">
          <span className={cn("font-medium", soldOut && "text-muted")}>
            {formatPrice(product.priceCents)}
          </span>
          {soldOut && <span className="text-muted">Sold out</span>}
        </p>
      </div>
    </Link>
  );
}
