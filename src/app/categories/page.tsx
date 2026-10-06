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

/**
 * Products shown per category; a "Shop all" tile completes the row, so
 * each category is one full row on desktop and two on mobile.
 */
const PREVIEW_COUNT = 3;

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
        {collections.map((collection, i) => (
          <ProductShowcase
            key={collection.slug}
            title={collection.name}
            description={collection.description}
            products={collection.products.slice(0, PREVIEW_COUNT)}
            viewAll={{
              href: categoryHref(collection.slug),
              title: collection.name,
              count: collection.products.length,
            }}
            showCategory={false}
            eager={i === 0}
          />
        ))}
      </div>
    </>
  );
}
