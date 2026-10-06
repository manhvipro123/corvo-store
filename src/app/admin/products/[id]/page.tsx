import type { Metadata } from "next";
import { notFound } from "next/navigation";

import { updateProduct } from "@/app/admin/products/actions";
import { ProductForm } from "@/components/admin/product-form";
import { StockForm } from "@/components/admin/stock-form";
import { StockStatus } from "@/components/product/stock-status";
import { TextLink } from "@/components/ui/text-link";
import { getAdminCategories, getAdminProduct } from "@/db/queries";
import { parseRouteId } from "@/lib/admin";
import { LOW_STOCK_THRESHOLD } from "@/lib/catalog";
import { requireAdmin } from "@/lib/session";

export const metadata: Metadata = { title: "Admin: Edit product" };

export default async function EditProductPage({
  params,
}: PageProps<"/admin/products/[id]">) {
  const { id: param } = await params;
  await requireAdmin(`/admin/products/${encodeURIComponent(param)}`);
  const id = parseRouteId(param);
  if (id === undefined) notFound();
  const [product, categories] = await Promise.all([
    getAdminProduct(id),
    getAdminCategories(),
  ]);
  if (!product) notFound();

  return (
    <section>
      <TextLink variant="nav" href="/admin/products" className="text-muted">
        ← All products
      </TextLink>
      <div className="mt-6 mb-10 flex flex-col gap-3">
        <h2 className="text-heading">{product.name}</h2>
        <div className="text-meta text-muted flex flex-wrap items-center gap-x-6 gap-y-2">
          <StockStatus stock={product.stock} className="text-foreground" />
          <TextLink variant="inline" href={`/products/${product.slug}`}>
            View in store
          </TextLink>
        </div>
      </div>
      <section
        aria-labelledby="availability-heading"
        className="border-border mb-12 flex flex-col gap-4 border-y py-6"
      >
        <div className="flex flex-col gap-1">
          <h3 id="availability-heading" className="text-heading">
            Availability
          </h3>
          <p className="text-meta text-muted max-w-prose">
            Units available to sell. 0 shows the product as sold out; 1–
            {LOW_STOCK_THRESHOLD} as “Only N left”. Units in open checkouts are
            already deducted and come back if a checkout ends unpaid.
          </p>
        </div>
        <StockForm
          productId={product.id}
          productName={product.name}
          available={product.stock}
        />
      </section>

      <ProductForm
        // A fresh form (and slug-sync state) per product.
        key={product.id}
        action={updateProduct.bind(null, product.id)}
        categories={categories.map(({ id, name }) => ({ id, name }))}
        product={product}
      />
    </section>
  );
}
