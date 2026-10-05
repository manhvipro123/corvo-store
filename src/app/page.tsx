import { CategoryIndex } from "@/components/home/category-index";
import { EditorialStory } from "@/components/home/editorial-story";
import { FeaturedCollections } from "@/components/home/featured-collections";
import { Hero } from "@/components/home/hero";
import { Services } from "@/components/home/services";
import { ProductFeature } from "@/components/product/product-feature";
import { ProductShowcase } from "@/components/product/product-showcase";
import { essentialsCampaign, essentialsSlugs } from "@/data/collections";
import { getNewArrivals, getProductsBySlugs } from "@/db/queries";

// Static, refreshed from the database at most once a minute.
export const revalidate = 60;

export default async function HomePage() {
  const [newArrivals, essentials] = await Promise.all([
    getNewArrivals(4),
    getProductsBySlugs(essentialsSlugs),
  ]);

  return (
    <>
      <Hero />
      <ProductShowcase
        title="New arrivals"
        products={newArrivals}
        action={{ label: "View all", href: "/new-arrivals" }}
      />
      <FeaturedCollections />
      <ProductFeature
        title="Wardrobe essentials"
        campaign={{
          title: "The leather edit",
          href: "/products?category=bags",
          image: essentialsCampaign,
        }}
        products={essentials}
        action={{ label: "Shop all", href: "/products" }}
      />
      <EditorialStory />
      <CategoryIndex />
      <Services />
    </>
  );
}
