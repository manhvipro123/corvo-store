import type { Metadata } from "next";
import Link from "next/link";
import { ChevronRight, Search } from "lucide-react";

import { EmptyState } from "@/components/admin/empty-state";
import { FilterTabs } from "@/components/admin/filter-tabs";
import { ProductImage } from "@/components/product/product-image";
import { StockStatus } from "@/components/product/stock-status";
import { buttonVariants } from "@/components/ui/button";
import { MediaFrame } from "@/components/ui/media-frame";
import { getAdminProducts, getCategories } from "@/db/queries";
import { adminHref, firstParam } from "@/lib/admin";
import { formatPrice } from "@/lib/format";
import { normalizeQuery } from "@/lib/search";
import { requireAdmin } from "@/lib/session";

export const metadata: Metadata = { title: "Admin: Products" };

export default async function AdminProductsPage({
  searchParams,
}: PageProps<"/admin/products">) {
  await requireAdmin("/admin/products");
  const params = await searchParams;
  const categories = await getCategories();
  const category = categories.find(
    (c) => c.slug === firstParam(params, "category"),
  )?.slug;
  const query = normalizeQuery(params.q) || undefined;
  const products = await getAdminProducts({ category, query });

  const tabs = [
    { slug: undefined, name: "All" },
    ...categories.map((c) => ({ slug: c.slug, name: c.name })),
  ].map((c) => ({
    label: c.name,
    href: adminHref("/admin/products", { category: c.slug, q: query }),
    active: c.slug === category,
  }));

  return (
    <section className="grid grid-cols-[minmax(0,1fr)]">
      <div className="mb-6 flex items-end justify-between gap-4 md:mb-8">
        <div className="flex flex-col gap-1">
          <h2 className="text-heading">Products</h2>
          <p className="text-meta text-muted">In Recommended order.</p>
        </div>
        <Link
          href="/admin/products/new"
          className={buttonVariants({ size: "sm", className: "shrink-0" })}
        >
          New product
        </Link>
      </div>

      <form
        action="/admin/products"
        role="search"
        className="border-border mb-2 flex items-center gap-3 border-b"
      >
        {category && <input type="hidden" name="category" value={category} />}
        <Search
          className="text-muted size-4 shrink-0"
          strokeWidth={1.5}
          aria-hidden
        />
        <label htmlFor="q" className="sr-only">
          Search products
        </label>
        <input
          id="q"
          name="q"
          type="search"
          defaultValue={query}
          placeholder="Search by name, SKU or slug"
          className="text-body h-12 min-w-0 flex-1 bg-transparent outline-none"
        />
      </form>
      <FilterTabs label="Categories" tabs={tabs} className="mb-2" />

      {products.length === 0 ? (
        <EmptyState
          title="No products found."
          description={
            query
              ? "Nothing matches that search. Check the spelling or try fewer words."
              : "There are no products in this category yet."
          }
          action={{ label: "All products", href: "/admin/products" }}
        />
      ) : (
        <ul>
          {products.map((product, i) => (
            <li key={product.id} className="border-border border-b">
              <Link
                href={`/admin/products/${product.id}`}
                className="group grid grid-cols-[3.5rem_minmax(0,1fr)_auto] items-center gap-x-4 gap-y-1 py-4 sm:grid-cols-[3.5rem_minmax(0,1fr)_6rem_8rem_auto]"
              >
                <MediaFrame className="row-span-2 sm:row-span-1">
                  <ProductImage
                    image={product.image}
                    sizes="56px"
                    loading={i < 8 ? "eager" : undefined}
                  />
                </MediaFrame>
                <div className="flex min-w-0 flex-col gap-1">
                  <span className="text-meta truncate font-medium">
                    {product.name}
                  </span>
                  <span className="text-meta text-muted truncate">
                    {product.sku} · {product.categoryName}
                    {product.isNew && " · New"}
                  </span>
                </div>
                <span className="text-meta text-right font-medium tabular-nums sm:text-left">
                  {formatPrice(product.priceCents)}
                </span>
                <StockStatus
                  stock={product.stock}
                  className="col-start-2 sm:col-start-auto"
                />
                <span className="text-meta text-muted group-hover:text-foreground col-start-3 row-start-2 flex items-center justify-end gap-1 transition-colors sm:col-start-auto sm:row-start-auto">
                  Edit
                  <ChevronRight
                    className="size-3.5"
                    strokeWidth={1.5}
                    aria-hidden
                  />
                </span>
              </Link>
            </li>
          ))}
        </ul>
      )}
    </section>
  );
}
