import type { Metadata } from "next";

import { ProductShowcase } from "@/components/product/product-showcase";
import { Container } from "@/components/ui/container";
import { categoriesDescription } from "@/data/collections";
import { getCategories, getProducts } from "@/db/queries";
import { categoryHref, defaultFilters } from "@/lib/catalog";

export const metadata: Metadata = {
  title: "Categories",
  description: categoriesDescription,
};

// Static, refreshed from the database at most once a minute (as the homepage).
export const revalidate = 60;

/** Products shown per category: one full row on desktop. */
const PREVIEW_COUNT = 4;

export default async function CategoriesPage() {
  const [categories, products] = await Promise.all([
    getCategories(),
    getProducts(defaultFilters),
  ]);

  // Both lists arrive in merchandised order; group products by category.
  const collections = categories
    .map((category) => ({
      ...category,
      products: products.filter((p) => p.category === category.slug),
    }))
    .filter((collection) => collection.products.length > 0);

  return (
    <>
      <Container
        inset="tile"
        className="flex flex-col gap-2 pt-8 pb-6 md:pt-12 md:pb-8"
      >
        <h1 className="text-title">Categories</h1>
        <p className="text-body text-muted max-w-prose">
          {categoriesDescription}
        </p>
      </Container>

      <div className="border-border border-t">
        {collections.map((collection) => (
          <ProductShowcase
            key={collection.slug}
            title={`${collection.name} (${collection.products.length})`}
            description={collection.description}
            products={collection.products.slice(0, PREVIEW_COUNT)}
            action={{ label: "Shop all", href: categoryHref(collection.slug) }}
            showCategory={false}
          />
        ))}
      </div>
    </>
  );
}
