import type { Metadata } from "next";

import { SectionHeader } from "@/components/ui/section-header";
import { getCategories, getProducts } from "@/db/queries";
import { defaultFilters, getStockStatus } from "@/lib/catalog";
import { requireAdmin } from "@/lib/session";

export const metadata: Metadata = { title: "Admin" };

/** Read-only catalog counts. */
export default async function AdminPage() {
  await requireAdmin("/admin");
  const [products, categories] = await Promise.all([
    getProducts(defaultFilters),
    getCategories(),
  ]);
  const count = (status: ReturnType<typeof getStockStatus>) =>
    products.filter((p) => getStockStatus(p.stock) === status).length;
  const stats = [
    ["Products", products.length],
    ["Categories", categories.length],
    ["Sold out", count("sold-out")],
    ["Low stock", count("low-stock")],
  ] as const;

  return (
    <section>
      <SectionHeader title="Overview" />
      <dl className="border-border grid grid-cols-2 border-t md:grid-cols-4">
        {stats.map(([label, value]) => (
          <div
            key={label}
            className="border-border flex flex-col gap-2 border-b py-6"
          >
            <dt className="text-label text-muted">{label}</dt>
            <dd className="text-display tabular-nums">{value}</dd>
          </div>
        ))}
      </dl>
    </section>
  );
}
