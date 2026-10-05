import { ProductCard } from "@/components/product/product-card";
import { ViewAllTile } from "@/components/product/view-all-tile";
import { Container } from "@/components/ui/container";
import { Grid } from "@/components/ui/grid";
import { Section } from "@/components/ui/section";
import { SectionHeader } from "@/components/ui/section-header";
import type { Product } from "@/types/catalog";

/** Titled, edge-to-edge row of product cards. */
export function ProductShowcase({
  title,
  description,
  products,
  action,
  viewAll,
  showCategory,
  eager,
}: {
  title: string;
  description?: string;
  products: Product[];
  action?: { label: string; href: string };
  /** Closing "Shop all" tile for the whole collection (fills the row). */
  viewAll?: { href: string; title: string; count: number };
  /** Pass false when the whole row is one category. */
  showCategory?: boolean;
  /** The row is above the fold: load its images now. */
  eager?: boolean;
}) {
  return (
    // No bottom padding: the cards' own caption space closes the section.
    <Section aria-label={title} className="pb-0 md:pb-0">
      <Container inset="tile">
        <SectionHeader
          title={title}
          description={description}
          action={action}
        />
      </Container>
      <Container inset="bleed">
        <Grid>
          {products.map((product) => (
            <li key={product.slug}>
              <ProductCard
                product={product}
                showCategory={showCategory}
                eager={eager}
              />
            </li>
          ))}
          {viewAll && <ViewAllTile {...viewAll} cardCount={products.length} />}
        </Grid>
      </Container>
    </Section>
  );
}
