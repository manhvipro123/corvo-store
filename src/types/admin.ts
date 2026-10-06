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
  /** Units in pending checkouts within their reservation or grace period. */
  onHold: number;
  /** Units in pending checkouts past the grace period, awaiting the sweep. */
  staleHolds: number;
  /** Units in checkouts paid at Stripe whose webhook never came; won't come back. */
  needsReconcile: number;
  /** Units in checkouts whose delayed payment is still clearing. */
  processing: number;
};

/** One row of a product's stock history (`stock_movements`). */
export type StockMovement = {
  id: number;
  delta: number;
  quantityAfter: number;
  reason: "initial" | "admin_set" | "admin_adjust" | "reserve" | "release";
  orderId: string | null;
  note: string | null;
  /** The admin behind a manual change, if their account still exists. */
  actorName: string | null;
  createdAt: Date;
};

export type AdminOrderListItem = OrderListItem & {
  customerName: string;
  customerEmail: string;
  /** Pending, but Stripe reported the session complete (see `reconcile_needed_at`). */
  needsReconcile: boolean;
};

export type AdminOrder = Order & {
  customer: { id: string; name: string; email: string };
  stripeCheckoutSessionId: string | null;
  stripePaymentIntentId: string | null;
  paidAt: Date | null;
  expiresAt: Date;
  needsReconcile: boolean;
};

export type AdminOrderFilter = OrderStatus | "placed" | "reconcile" | "all";
