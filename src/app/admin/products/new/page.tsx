import type { Metadata } from "next";

import { createProduct } from "@/app/admin/products/actions";
import { ProductForm } from "@/components/admin/product-form";
import { TextLink } from "@/components/ui/text-link";
import { getAdminCategories } from "@/db/queries";
import { requireAdmin } from "@/lib/session";

export const metadata: Metadata = { title: "Admin: New product" };

export default async function NewProductPage() {
  await requireAdmin("/admin/products/new");
  const categories = await getAdminCategories();

  return (
    <section>
      <TextLink variant="nav" href="/admin/products" className="text-muted">
        ← All products
      </TextLink>
      <h2 className="text-heading mt-6 mb-10">New product</h2>
      <ProductForm
        action={createProduct}
        categories={categories.map(({ id, name }) => ({ id, name }))}
      />
    </section>
  );
}
