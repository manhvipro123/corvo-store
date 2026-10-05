import { unsplash } from "../lib/images";
import type { ColorSlug, ImageAsset } from "../types/catalog";

/**
 * Development/test catalog loaded by `npm run db:seed`. Array order becomes
 * `position` (the merchandised "Recommended" order). Images: Unsplash
 * (unsplash.com/license), chosen for light, neutral backdrops.
 */

export type SeedCategory = {
  slug: string;
  name: string;
  description: string;
};

export type SeedProduct = {
  slug: string;
  name: string;
  /** Category slug. */
  category: string;
  color: ColorSlug;
  priceCents: number;
  image: ImageAsset;
  isNew?: boolean;
  sku: string;
  description: string;
  details: string[];
  /** Initial `product_stock.quantity`. */
  stock: number;
};

export const seedCategories: SeedCategory[] = [
  {
    slug: "ready-to-wear",
    name: "Ready-to-wear",
    description: "Soft tailoring, outerwear and knitwear cut to be layered.",
  },
  {
    slug: "bags",
    name: "Bags",
    description: "Top handles, totes and satchels in hand-finished leather.",
  },
  {
    slug: "shoes",
    name: "Shoes",
    description: "Slingbacks and boots on leather soles, made to wear in.",
  },
  {
    slug: "accessories",
    name: "Accessories",
    description: "Eyewear, watches and small leather goods for every day.",
  },
  {
    slug: "jewelry",
    name: "Jewelry",
    description: "Fine rings in gold, designed to be worn together or apart.",
  },
];

export const seedProducts: SeedProduct[] = [
  {
    slug: "top-handle-bag-cognac",
    name: "Top handle bag in polished leather",
    category: "bags",
    color: "brown",
    priceCents: 265000,
    isNew: true,
    image: {
      src: unsplash("photo-1691480150204-66dd1eb77391"),
      alt: "Cognac leather top handle bag on white",
    },
    sku: "CV-BG-1001",
    description:
      "A structured top handle bag in polished calf leather, with a removable shoulder strap and a single interior compartment sized for the everyday.",
    details: [
      "Polished calf leather",
      "Gold-tone hardware",
      "Removable, adjustable shoulder strap",
      "W 32 \u00d7 H 22 \u00d7 D 14 cm",
    ],
    stock: 8,
  },
  {
    slug: "slouch-bag-noir",
    name: "Soft slouch bag",
    category: "bags",
    color: "black",
    priceCents: 219000,
    isNew: true,
    image: {
      fit: "cover",
      src: unsplash("photo-1758542988969-39a10168b2ce"),
      alt: "Black leather slouch bag resting on a white surface",
    },
    sku: "CV-BG-1002",
    description:
      "A soft, unlined bag gathered at the top so it folds into itself when set down. Light enough to carry all day.",
    details: [
      "Supple lambskin",
      "Magnetic closure",
      "Interior slip pocket",
      "W 36 \u00d7 H 24 \u00d7 D 12 cm",
    ],
    stock: 12,
  },
  {
    slug: "slingback-pump-noir",
    name: "Patent slingback pump",
    category: "shoes",
    color: "black",
    priceCents: 99000,
    isNew: true,
    image: {
      src: unsplash("photo-1789110519431-0a9bf0af5074"),
      alt: "Black patent leather slingback shoe with a sculpted heel",
    },
    sku: "CV-SH-2001",
    description:
      "A pointed slingback in crinkled patent leather, set on a low sculpted heel.",
    details: [
      "Patent calf leather upper",
      "Leather lining and sole",
      "Adjustable buckle strap",
      "Heel height 3.5 cm",
    ],
    stock: 2,
  },
  {
    slug: "acetate-sunglasses-black",
    name: "Rounded acetate sunglasses",
    category: "accessories",
    color: "black",
    priceCents: 52000,
    isNew: true,
    image: {
      src: unsplash("photo-1584036553516-bf83210aa16c"),
      alt: "Black framed sunglasses on a white surface",
    },
    sku: "CV-AC-4001",
    description:
      "Rounded frames cut from a single block of acetate, with gradient lenses and full UV protection.",
    details: [
      "Italian acetate frame",
      "Gradient grey lenses, 100% UV protection",
      "Includes leather case",
    ],
    stock: 20,
  },
  {
    slug: "trench-coat-stone",
    name: "Double-breasted cotton trench",
    category: "ready-to-wear",
    color: "neutral",
    priceCents: 320000,
    isNew: true,
    image: {
      fit: "cover",
      src: unsplash("photo-1722859031306-4c81e8d83957"),
      alt: "Stone trench coat hanging on a rail beside darker coats",
    },
    sku: "CV-RW-3001",
    description:
      "A double-breasted trench in water-resistant cotton gabardine, cut long with a relaxed shoulder and a detachable belt.",
    details: [
      "100% cotton gabardine",
      "Water-resistant finish",
      "Horn buttons",
      "Made in Italy",
    ],
    stock: 5,
  },
  {
    slug: "tweed-jacket-grey",
    name: "Tailored tweed jacket",
    category: "ready-to-wear",
    color: "grey",
    priceCents: 280000,
    image: {
      fit: "cover",
      src: unsplash("photo-1722858958066-97deb3471c89"),
      alt: "Grey tweed jacket on a hanger in a white closet",
    },
    sku: "CV-RW-3002",
    description:
      "A single-breasted jacket in a soft wool tweed, lightly structured and finished with a half lining.",
    details: [
      "Wool and alpaca tweed",
      "Half lined in cupro",
      "Two flap pockets",
      "Made in Italy",
    ],
    stock: 3,
  },
  {
    slug: "structured-satchel-dove",
    name: "Structured satchel in grained leather",
    category: "bags",
    color: "grey",
    priceCents: 245000,
    image: {
      src: unsplash("photo-1605733513597-a8f8341084e6"),
      alt: "Grey leather satchel with gold buckles",
    },
    sku: "CV-BG-1003",
    description:
      "A compact satchel in grained leather with twin buckle straps and a top handle.",
    details: [
      "Grained calf leather",
      "Gold-tone buckles",
      "Detachable crossbody strap",
      "W 26 \u00d7 H 19 \u00d7 D 10 cm",
    ],
    stock: 7,
  },
  {
    slug: "diamond-ring-gold",
    name: "Twin stone ring in 18k gold",
    category: "jewelry",
    color: "gold",
    priceCents: 165000,
    isNew: true,
    image: {
      fit: "cover",
      src: unsplash("photo-1708222170603-12471477b1d9"),
      alt: "Gold ring set with two small diamonds",
    },
    sku: "CV-JW-5001",
    description:
      "A slim band in 18k yellow gold, set with two brilliant-cut diamonds side by side.",
    details: [
      "18k yellow gold",
      "Two diamonds, 0.10 ct total",
      "Band width 2 mm",
    ],
    stock: 4,
  },
  {
    slug: "poplin-shirt-white",
    name: "Cotton poplin shirt",
    category: "ready-to-wear",
    color: "white",
    priceCents: 69000,
    image: {
      src: unsplash("photo-1556630184-066f7ac4e15f"),
      alt: "White shirt on a wooden hanger",
    },
    sku: "CV-RW-3003",
    description:
      "A crisp cotton poplin shirt with a soft collar and a slightly oversized fit.",
    details: ["100% cotton poplin", "Mother-of-pearl buttons", "Relaxed fit"],
    stock: 25,
  },
  {
    slug: "tote-tan",
    name: "Everyday tote in vegetable-tanned leather",
    category: "bags",
    color: "brown",
    priceCents: 175000,
    image: {
      fit: "cover",
      src: unsplash("photo-1624687943971-e86af76d57de"),
      alt: "Tan leather tote hanging against a white door",
    },
    sku: "CV-BG-1004",
    description:
      "An open tote in vegetable-tanned leather that darkens and softens with use.",
    details: [
      "Vegetable-tanned leather",
      "Raw-edge finish",
      "Interior zip pocket",
      "W 38 \u00d7 H 34 \u00d7 D 12 cm",
    ],
    stock: 9,
  },
  {
    slug: "suede-ankle-boot-tobacco",
    name: "Suede ankle boot",
    category: "shoes",
    color: "brown",
    priceCents: 115000,
    image: {
      src: unsplash("photo-1605733160314-4fc7dac4bb16"),
      alt: "Pair of tan suede ankle boots",
    },
    sku: "CV-SH-2002",
    description:
      "A low ankle boot in brushed suede with a side zip and a stacked leather heel.",
    details: [
      "Calf suede upper",
      "Leather lining",
      "Rubber-insert leather sole",
      "Heel height 3 cm",
    ],
    stock: 6,
  },
  {
    slug: "wool-jacket-noir",
    name: "Boiled wool jacket",
    category: "ready-to-wear",
    color: "black",
    priceCents: 235000,
    image: {
      fit: "cover",
      src: unsplash("photo-1658418818804-adc6dc129ac2"),
      alt: "Black jacket hanging on a white wall",
    },
    sku: "CV-RW-3004",
    description:
      "A collarless jacket in boiled wool, unlined for a soft, easy drape.",
    details: [
      "100% boiled wool",
      "Unlined",
      "Concealed button placket",
      "Made in Italy",
    ],
    stock: 4,
  },
  {
    slug: "leather-strap-watch",
    name: "Minimal dial watch",
    category: "accessories",
    color: "black",
    priceCents: 145000,
    image: {
      src: unsplash("photo-1758887952896-8491d393afe2"),
      alt: "Black watch with a leather strap on white",
    },
    sku: "CV-AC-4002",
    description:
      "A minimal dial on a slim steel case, worn on a black calf leather strap.",
    details: [
      "38 mm brushed steel case",
      "Swiss quartz movement",
      "Calf leather strap",
      "Water resistant to 30 m",
    ],
    stock: 10,
  },
  {
    slug: "card-case-noir",
    name: "Slim card case",
    category: "accessories",
    color: "black",
    priceCents: 39000,
    image: {
      fit: "cover",
      src: unsplash("photo-1601592996763-f05c9c80a7f1"),
      alt: "Two black leather card cases on grey stone",
    },
    sku: "CV-AC-4003",
    description:
      "A slim card case in smooth leather with four card slots and a central pocket.",
    details: [
      "Smooth calf leather",
      "4 card slots, 1 central pocket",
      "W 10 \u00d7 H 7 cm",
    ],
    stock: 30,
  },
  {
    slug: "cashmere-rib-sweater",
    name: "Cashmere rib knit sweater",
    category: "ready-to-wear",
    color: "neutral",
    priceCents: 135000,
    image: {
      fit: "cover",
      src: unsplash("photo-1602706294170-1fed8eecd9f9"),
      alt: "Folded knit sweaters in cream, sand and mustard",
    },
    sku: "CV-RW-3005",
    description:
      "A rib-knit sweater in pure cashmere with a relaxed body and a high, soft neck.",
    details: ["100% cashmere", "Rib knit", "Relaxed fit"],
    stock: 11,
  },
  {
    slug: "brogue-boot-chestnut",
    name: "Brogue lace-up boot",
    category: "shoes",
    color: "brown",
    priceCents: 129000,
    image: {
      src: unsplash("photo-1638609348722-aa2a3a67db26"),
      alt: "Chestnut leather brogue boots",
    },
    sku: "CV-SH-2003",
    description:
      "A lace-up brogue boot in burnished leather, finished with a Goodyear-welted sole.",
    details: [
      "Burnished calf leather",
      "Goodyear-welted leather sole",
      "Leather lining",
    ],
    stock: 1,
  },
  {
    slug: "overshirt-khaki",
    name: "Washed cotton overshirt",
    category: "ready-to-wear",
    color: "neutral",
    priceCents: 89000,
    image: {
      fit: "cover",
      src: unsplash("photo-1776838103951-993ff1ffc916"),
      alt: "Tan collared overshirt on a hanger",
    },
    sku: "CV-RW-3006",
    description:
      "A washed cotton overshirt with two chest pockets, meant to be layered.",
    details: ["100% cotton twill", "Garment washed", "Corozo buttons"],
    stock: 14,
  },
  {
    slug: "stacking-rings-gold",
    name: "Stacking rings, set of five",
    category: "jewelry",
    color: "gold",
    priceCents: 98000,
    image: {
      src: unsplash("photo-1731586249471-82bb9b2f769a"),
      alt: "Gold rings scattered on white linen",
    },
    sku: "CV-JW-5002",
    description:
      "Five fine bands in gold vermeil, designed to be worn together or apart.",
    details: [
      "Gold vermeil on sterling silver",
      "Set of five bands",
      "Band width 1\u20132 mm",
    ],
    stock: 0,
  },
];
