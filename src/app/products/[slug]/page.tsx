import type { Metadata } from "next";
import { notFound } from "next/navigation";

import { ProductDetails } from "@/components/product/product-details";
import { ProductGallery } from "@/components/product/product-gallery";
import { ProductShowcase } from "@/components/product/product-showcase";
import { Container } from "@/components/ui/container";
import {
  getProductBySlug,
  getProductSlugs,
  getRelatedProducts,
} from "@/db/queries";
import { categoryHref } from "@/lib/catalog";

// Prerendered at build, refreshed from the database at most once a minute.
// Products added later render on first request; unknown slugs 404 below.
export const revalidate = 60;

export async function generateStaticParams() {
  return (await getProductSlugs()).map((slug) => ({ slug }));
}

export async function generateMetadata({
  params,
}: PageProps<"/products/[slug]">): Promise<Metadata> {
  const product = await getProductBySlug((await params).slug);
  if (!product) return {};
  return { title: product.name, description: product.description };
}

export default async function ProductPage({
  params,
}: PageProps<"/products/[slug]">) {
  const product = await getProductBySlug((await params).slug);
  if (!product) notFound();

  const related = await getRelatedProducts(product);

  return (
    <>
      <Container inset="bleed" className="lg:grid lg:grid-cols-12">
        <div className="lg:col-span-7">
          <ProductGallery images={[product.image]} />
        </div>
        {/*
          Info column: sticky and vertically centred against the first,
          viewport-tall image, so price and action sit in view beside it.
        */}
        <div className="lg:col-span-5">
          <div className="px-gutter lg:top-header flex justify-center py-8 md:px-6 md:py-10 lg:sticky lg:min-h-[calc(100svh-var(--header-height))] lg:items-center lg:px-12 lg:py-16">
            <div className="w-full lg:max-w-md">
              <ProductDetails product={product} />
            </div>
          </div>
        </div>
      </Container>

      <ProductShowcase
        title="You may also like"
        products={related}
        action={{ label: "View all", href: categoryHref(product.category) }}
      />
    </>
  );
}
