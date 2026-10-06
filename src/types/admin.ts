import type {
  ImageAsset,
  Order,
  OrderListItem,
  OrderStatus,
  Product,
} from "@/types/catalog";

/** A product as the admin edits it: the storefront fields plus merchandising. */
export type AdminProduct = Product & {
  categoryId: number;
  /** Global "Recommended" order. */
  position: number;
};

export type AdminCategory = {
  id: number;
  slug: string;
  name: string;
  description: string;
  /** Tab order on /products. */
  position: number;
  productCount: number;
};

/** One product on the inventory screen. */
export type InventoryRow = {
  id: number;
  slug: string;
  name: string;
  sku: string;
  categoryName: string;
  image: ImageAsset;
  /** Units that can still be sold (open checkouts are already deducted). */
  available: number;
  /** Units reserved by pending checkouts; they return if a checkout expires. */
  onHold: number;
};

export type AdminOrderListItem = OrderListItem & {
  customerName: string;
  customerEmail: string;
};

export type AdminOrder = Order & {
  customer: { id: string; name: string; email: string };
  stripeCheckoutSessionId: string | null;
  stripePaymentIntentId: string | null;
  paidAt: Date | null;
  expiresAt: Date;
};

export type AdminOrderFilter = OrderStatus | "placed" | "all";
