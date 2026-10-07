import type { Metadata } from "next";
import Link from "next/link";

import { SectionHeader } from "@/components/ui/section-header";
import { getAdminCategories, getInventoryCounts } from "@/db/queries";
import { requireAdmin } from "@/lib/session";

export const metadata: Metadata = { title: "Admin" };

/** Catalog counts, each linking to where it can be acted on. */
export default async function AdminPage() {
  await requireAdmin("/admin");
  const [counts, categories] = await Promise.all([
    getInventoryCounts(),
    getAdminCategories(),
  ]);
  const stats = [
    ["Products", counts.products, "/admin/products"],
    ["Categories", categories.length, "/admin/categories"],
    ["Sold out", counts.soldOut, "/admin/inventory?status=sold-out"],
    ["Low stock", counts.lowStock, "/admin/inventory?status=low-stock"],
  ] as const;

  return (
    <section>
      <SectionHeader title="Overview" />
      <ul className="border-border grid grid-cols-2 border-t md:grid-cols-4">
        {stats.map(([label, value, href]) => (
          <li key={label} className="border-border border-b">
            <Link
              href={href}
              className="flex flex-col gap-2 py-6 transition-opacity hover:opacity-70"
            >
              <span className="text-label text-muted">{label}</span>
              <span className="text-display tabular-nums">{value}</span>
            </Link>
          </li>
        ))}
      </ul>
      {counts.staleHolds > 0 && (
        <p className="text-meta mt-6">
          {counts.staleHolds} expired{" "}
          {counts.staleHolds === 1 ? "checkout is" : "checkouts are"} still
          holding stock.{" "}
          <Link
            href="/admin/inventory"
            className="underline underline-offset-2 hover:opacity-70"
          >
            Release in Inventory
          </Link>
        </p>
      )}
      {counts.needsReconcile > 0 && (
        <p className="text-meta mt-6">
          {counts.needsReconcile}{" "}
          {counts.needsReconcile === 1 ? "checkout was" : "checkouts were"}{" "}
          completed at Stripe without a webhook and still{" "}
          {counts.needsReconcile === 1 ? "holds" : "hold"} stock.{" "}
          <Link
            href="/admin/orders?status=reconcile"
            className="underline underline-offset-2 hover:opacity-70"
          >
            View {counts.needsReconcile === 1 ? "order" : "orders"}
          </Link>
        </p>
      )}
    </section>
  );
}
