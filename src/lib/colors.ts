import type { ColorSlug } from "@/types/catalog";

/**
 * Display data for the `product_color` enum. Kept in code (not the DB)
 * because the client-side filter sheet needs it. `swatch` is the product
 * colour itself, not a UI token.
 */
export const colors: { slug: ColorSlug; label: string; swatch: string }[] = [
  { slug: "black", label: "Black", swatch: "#111111" },
  { slug: "brown", label: "Brown", swatch: "#8a5a3b" },
  { slug: "neutral", label: "Neutral", swatch: "#d8c9b1" },
  { slug: "grey", label: "Grey", swatch: "#9a9a9a" },
  { slug: "white", label: "White", swatch: "#ffffff" },
  { slug: "gold", label: "Gold", swatch: "#c9a45c" },
];
