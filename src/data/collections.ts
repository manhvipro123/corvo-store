import { unsplash } from "@/lib/images";
import type { Collection } from "@/types/catalog";

// Images: Unsplash (unsplash.com/license).
export const heroCampaign = {
  eyebrow: "Autumn–Winter 2026",
  title: "The shape of quiet",
  cta: { label: "Discover the collection", href: "/products" },
  image: {
    src: unsplash("photo-1603189343302-e603f7add05a", 2400),
    alt: "Model in an oversized black coat against a white studio wall",
  },
};

export const featuredCollections: Collection[] = [
  {
    slug: "tailoring",
    title: "Soft Tailoring",
    description: "Relaxed shoulders, fluid wool, a new everyday uniform.",
    href: "/products",
    image: {
      src: unsplash("photo-1613915617430-8ab0fd7c6baf", 1600),
      alt: "Model in a grey wool coat and black trousers",
    },
  },
  {
    slug: "outerwear",
    title: "The Coat Edit",
    description: "Wrap coats and long silhouettes in warm neutrals.",
    href: "/products",
    image: {
      src: unsplash("photo-1550872199-63f4382fe925", 1600),
      alt: "Model in a camel wrap coat over a red dress",
    },
  },
];

export const essentialsCampaign = {
  src: unsplash("photo-1654707501497-e7880e6c88c0", 1600),
  alt: "Model dressed in black leaning over a black leather bag in a white studio",
};

export const editorialStory = {
  eyebrow: "The Journal",
  title: "Dressing for the long season",
  body: "Heavier wools, darker lenses, and pieces cut to be layered. A short guide to building a wardrobe that carries you from the first cold morning to the last.",
  cta: { label: "Read the story", href: "/products" },
  image: {
    src: unsplash("photo-1645561305502-63a9ba09ab09", 1600),
    alt: "Black and white portrait of a woman in sunglasses and a wool coat",
  },
};

/** Intro line on /categories. */
export const categoriesDescription =
  "Every part of the collection, gathered by category.";

/** Intro line on /new-arrivals. */
export const newArrivalsDescription =
  "The latest pieces to join the collection, from leather goods to jewelry.";

/** Intro line on /products when no category is selected. */
export const allProductsDescription =
  "The full collection: ready-to-wear, leather goods, shoes and jewelry.";

/** Hand-picked homepage "Wardrobe essentials", in display order. */
export const essentialsSlugs = [
  "structured-satchel-dove",
  "tote-tan",
  "card-case-noir",
  "cashmere-rib-sweater",
];
