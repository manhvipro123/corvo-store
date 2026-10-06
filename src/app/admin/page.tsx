import type { Metadata } from "next";
import Link from "next/link";

import { SectionHeader } from "@/components/ui/section-header";
import { getAdminCategories, getInventory } from "@/db/queries";
import { getStockStatus } from "@/lib/catalog";
import { requireAdmin } from "@/lib/session";

export const metadata: Metadata = { title: "Admin" };

/** Catalog counts, each linking to where it can be acted on. */
export default async function AdminPage() {
  await requireAdmin("/admin");
  const [inventory, categories] = await Promise.all([
    getInventory({}),
    getAdminCategories(),
  ]);
  const count = (status: ReturnType<typeof getStockStatus>) =>
    inventory.filter((row) => getStockStatus(row.available) === status).length;
  const stats = [
    ["Products", inventory.length, "/admin/products"],
    ["Categories", categories.length, "/admin/categories"],
    ["Sold out", count("sold-out"), "/admin/inventory?status=sold-out"],
    ["Low stock", count("low-stock"), "/admin/inventory?status=low-stock"],
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
    </section>
  );
}
