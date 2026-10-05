import type { Metadata } from "next";
import Link from "next/link";

import { ActiveFilters } from "@/components/catalog/active-filters";
import { CategoryTabs } from "@/components/catalog/category-tabs";
import { FilterSheet } from "@/components/catalog/filter-sheet";
import { SearchForm } from "@/components/catalog/search-form";
import { ProductCard } from "@/components/product/product-card";
import { buttonVariants } from "@/components/ui/button";
import { Container } from "@/components/ui/container";
import { Grid } from "@/components/ui/grid";
import { TextLink } from "@/components/ui/text-link";
import { getCategories, getProducts } from "@/db/queries";
import { categoryHref, filtersHref, parseFilters } from "@/lib/catalog";
import { normalizeQuery } from "@/lib/search";
import type { Category } from "@/types/catalog";

export async function generateMetadata({
  searchParams,
}: PageProps<"/search">): Promise<Metadata> {
  const query = normalizeQuery((await searchParams).q);
  return {
    title: query ? `Search: ${query}` : "Search",
    // Result pages are endless permutations; keep them out of indexes.
    robots: { index: false },
  };
}

export default async function SearchPage({
  searchParams,
}: PageProps<"/search">) {
  const params = await searchParams;
  const query = normalizeQuery(params.q);
  const categories = await getCategories();

  // Same URL filters as /products, plus `q`; hrefs built from these stay on /search.
  const filters = {
    ...parseFilters(
      params,
      categories.map((c) => c.slug),
    ),
    query,
  };
  const results = query ? await getProducts(filters) : [];
  const filtered = Boolean(filters.category || filters.colors.length);

  return (
    <>
      <Container
        inset="tile"
        className="flex flex-col gap-6 pt-8 pb-6 md:pt-12 md:pb-8"
      >
        <h1 className="text-title">Search</h1>
        {/* Keyed so the field resets to the URL's query after navigation. */}
        <SearchForm key={query} defaultValue={query} autoFocus={!query} />
      </Container>

      {!query ? (
        <Container inset="tile" className="pt-4 pb-24">
          <BrowseCategories categories={categories} />
        </Container>
      ) : (
        <>
          {/* Same sticky toolbar as /products; every link keeps the query. */}
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
              <Grid>
                {results.map((product) => (
                  <li key={product.slug}>
                    <ProductCard
                      product={product}
                      showCategory={!filters.category}
                    />
                  </li>
                ))}
              </Grid>
            </Container>
          ) : (
            <Container
              inset="tile"
              className="flex flex-col items-start gap-8 pt-16 pb-24"
            >
              <div className="flex flex-col items-start gap-4">
                <p className="text-title">No pieces match “{query}”.</p>
                {filtered ? (
                  <Link
                    href={filtersHref(filters, {
                      category: undefined,
                      colors: [],
                    })}
                    scroll={false}
                    className={buttonVariants({ variant: "secondary" })}
                  >
                    Clear filters
                  </Link>
                ) : (
                  <>
                    <p className="text-body text-muted max-w-prose">
                      Try a shorter or more general word, such as “bag” or
                      “leather”.
                    </p>
                    <Link
                      href="/products"
                      className={buttonVariants({ variant: "secondary" })}
                    >
                      Shop all
                    </Link>
                  </>
                )}
              </div>
              {!filtered && <BrowseCategories categories={categories} />}
            </Container>
          )}
        </>
      )}
    </>
  );
}

function BrowseCategories({ categories }: { categories: Category[] }) {
  return (
    <div className="flex flex-col gap-3">
      <p className="text-label text-muted">Browse categories</p>
      <ul className="flex flex-wrap gap-x-6 gap-y-2">
        {categories.map((category) => (
          <li key={category.slug}>
            <TextLink href={categoryHref(category.slug)}>
              {category.name}
            </TextLink>
          </li>
        ))}
      </ul>
    </div>
  );
}
