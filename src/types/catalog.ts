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
  /** Database id; what the bag cookie stores. */
  id: number;
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

/** Mirrors the `order_status` enum in src/db/schema.ts. */
export type OrderStatus =
  "pending" | "processing" | "paid" | "failed" | "expired";

export type OrderLine = {
  productId: number;
  slug: string;
  name: string;
  sku: string;
  image: ImageAsset;
  /** Whole cents, USD, as charged. */
  unitPriceCents: number;
  quantity: number;
};

export type Order = {
  id: string;
  status: OrderStatus;
  subtotalCents: number;
  /** What Stripe charged; null until paid. */
  totalCents: number | null;
  email: string | null;
  shipping: {
    name: string;
    address: {
      line1: string | null;
      line2: string | null;
      city: string | null;
      state: string | null;
      postal_code: string | null;
      country: string | null;
    };
  } | null;
  createdAt: Date;
  lines: OrderLine[];
};
