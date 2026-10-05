import type { Metadata } from "next";
import Link from "next/link";

import { ProductCard } from "@/components/product/product-card";
import { buttonVariants } from "@/components/ui/button";
import { Container } from "@/components/ui/container";
import { Grid } from "@/components/ui/grid";
import { newArrivalsDescription } from "@/data/collections";
import { getNewArrivals } from "@/db/queries";

export const metadata: Metadata = {
  title: "New arrivals",
  description: newArrivalsDescription,
};

// Static, refreshed from the database at most once a minute (as the homepage).
export const revalidate = 60;

export default async function NewArrivalsPage() {
  const products = await getNewArrivals();

  return (
    <>
      {/* Same header and status rhythm as /products, without the filter bar. */}
      <Container
        inset="tile"
        className="flex flex-col gap-2 pt-8 pb-6 md:pt-12 md:pb-8"
      >
        <h1 className="text-title">New arrivals</h1>
        <p className="text-body text-muted max-w-prose">
          {newArrivalsDescription}
        </p>
      </Container>

      <Container
        inset="tile"
        className="border-border flex min-h-14 items-center border-t"
      >
        <p className="text-meta text-muted tabular-nums">
          {products.length} {products.length === 1 ? "item" : "items"}
        </p>
      </Container>

      {products.length > 0 ? (
        <Container inset="bleed">
          <Grid>
            {products.map((product) => (
              <li key={product.slug}>
                <ProductCard product={product} />
              </li>
            ))}
          </Grid>
        </Container>
      ) : (
        <Container
          inset="tile"
          className="flex flex-col items-start gap-4 pt-16 pb-24"
        >
          <p className="text-title">No new pieces right now.</p>
          <Link
            href="/products"
            className={buttonVariants({ variant: "secondary" })}
          >
            Shop all
          </Link>
        </Container>
      )}
    </>
  );
}
