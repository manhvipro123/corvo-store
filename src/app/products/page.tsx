import type { Metadata } from "next";
import Link from "next/link";
import { Fragment } from "react";

import { ActiveFilters } from "@/components/catalog/active-filters";
import { CampaignTile } from "@/components/product/campaign-tile";
import { CategoryTabs } from "@/components/catalog/category-tabs";
import { FilterSheet } from "@/components/catalog/filter-sheet";
import { ProductCard } from "@/components/product/product-card";
import { buttonVariants } from "@/components/ui/button";
import { Container } from "@/components/ui/container";
import { Grid } from "@/components/ui/grid";
import { allProductsDescription, essentialsCampaign } from "@/data/collections";
import { getCategories, getProducts } from "@/db/queries";
import { filtersHref, parseFilters } from "@/lib/catalog";

/** Index after which the campaign tile is inserted (one full desktop row). */
const CAMPAIGN_AFTER = 4;

export async function generateMetadata({
  searchParams,
}: PageProps<"/products">): Promise<Metadata> {
  const categories = await getCategories();
  const { category } = parseFilters(
    await searchParams,
    categories.map((c) => c.slug),
  );
  const current = categories.find((c) => c.slug === category);
  return {
    title: current?.name ?? "Shop all",
    description: current?.description ?? allProductsDescription,
  };
}

export default async function ProductsPage({
  searchParams,
}: PageProps<"/products">) {
  const categories = await getCategories();
  const filters = parseFilters(
    await searchParams,
    categories.map((c) => c.slug),
  );
  const results = await getProducts(filters);
  const current = categories.find((c) => c.slug === filters.category);

  // Only on the unfiltered, recommended view: once someone filters or sorts
  // they're comparing products, and an image would just push results down.
  const showCampaign =
    !filters.category &&
    !filters.colors.length &&
    filters.sort === "recommended";

  return (
    <>
      <Container
        inset="tile"
        className="flex flex-col gap-2 pt-8 pb-6 md:pt-12 md:pb-8"
      >
        <h1 className="text-title">{current?.name ?? "Shop all"}</h1>
        <p className="text-body text-muted max-w-prose">
          {current?.description ?? allProductsDescription}
        </p>
      </Container>

      {/* Sticky under the site header so filters stay reachable while browsing. */}
      <div className="border-border bg-background/95 top-header sticky z-30 border-b backdrop-blur">
        <Container inset="tile" className="flex items-center gap-6">
          <CategoryTabs categories={categories} filters={filters} />
          <FilterSheet filters={filters} resultCount={results.length} />
        </Container>
      </div>

      <Container inset="tile">
        <ActiveFilters filters={filters} resultCount={results.length} />
      </Container>

      {results.length > 0 ? (
        <Container inset="bleed">
          <Grid className="grid-flow-row-dense">
            {results.map((product, index) => (
              <Fragment key={product.slug}>
                {showCampaign && index === CAMPAIGN_AFTER && (
                  <CampaignTile
                    title="Wardrobe essentials"
                    href={filtersHref(filters, { category: "bags" })}
                    image={essentialsCampaign}
                  />
                )}
                <li>
                  <ProductCard
                    product={product}
                    showCategory={!filters.category}
                    eager={index < 4}
                  />
                </li>
              </Fragment>
            ))}
          </Grid>
        </Container>
      ) : (
        <Container
          inset="tile"
          className="flex flex-col items-start gap-4 pt-16 pb-24"
        >
          <p className="text-title">No pieces match these filters.</p>
          <Link
            href={filtersHref(filters, { colors: [] })}
            scroll={false}
            className={buttonVariants({ variant: "secondary" })}
          >
            Clear filters
          </Link>
        </Container>
      )}
    </>
  );
}
