import { CampaignTile } from "@/components/product/campaign-tile";
import { ProductCard } from "@/components/product/product-card";
import { Container } from "@/components/ui/container";
import { Grid } from "@/components/ui/grid";
import { Section } from "@/components/ui/section";
import { SectionHeader } from "@/components/ui/section-header";
import type { ImageAsset, Product } from "@/types/catalog";

/**
 * Asymmetric product block: one clickable campaign tile spanning two columns
 * and two rows beside a 2×2 set of cards on desktop; tile first, then cards,
 * on smaller screens. Same tile as the one interleaved on /products.
 */
export function ProductFeature({
  title,
  campaign,
  products,
  action,
}: {
  title: string;
  campaign: { title: string; href: string; image: ImageAsset };
  products: Product[];
  action?: { label: string; href: string };
}) {
  return (
    <Section aria-label={title} className="pb-0 md:pb-0">
      <Container inset="tile">
        <SectionHeader title={title} action={action} />
      </Container>
      <Container inset="bleed">
        <Grid className="grid-flow-row-dense">
          <CampaignTile {...campaign} headingLevel="h3" />
          {products.map((product) => (
            <li key={product.slug}>
              <ProductCard product={product} />
            </li>
          ))}
        </Grid>
      </Container>
    </Section>
  );
}
