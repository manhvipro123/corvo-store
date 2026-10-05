export type ImageAsset = {
  src: string;
  alt: string;
  /**
   * How a product shot sits in a fixed-ratio tile. "contain" (default) shows
   * the whole piece on the surface colour — right for cut-outs and landscape
   * shots. "cover" fills the tile — for portrait photos with their own
   * backdrop, where the crop is small.
   */
  fit?: "contain" | "cover";
};

/** Category slugs come from the database. */
export type CategorySlug = string;

export type Category = {
  slug: CategorySlug;
  name: string;
  description: string;
};

/** Mirrors the `product_color` enum in src/db/schema.ts. */
export type ColorSlug =
  "black" | "brown" | "neutral" | "grey" | "white" | "gold";

export type Product = {
  slug: string;
  name: string;
  category: CategorySlug;
  categoryName: string;
  color: ColorSlug;
  /** Whole cents, USD. */
  priceCents: number;
  image: ImageAsset;
  isNew?: boolean;
  sku: string;
  description: string;
  /** Short material / construction facts, one per line. */
  details: string[];
  /** Units available; 0 = sold out. */
  stock: number;
};

export type Collection = {
  slug: string;
  title: string;
  description: string;
  href: string;
  image: ImageAsset;
};
