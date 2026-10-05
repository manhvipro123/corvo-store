import type { Metadata } from "next";

import { Container } from "@/components/ui/container";
import { getCategories, getProducts } from "@/db/queries";
import { defaultFilters, getStockStatus } from "@/lib/catalog";
import { requireAdmin } from "@/lib/session";

export const metadata: Metadata = {
  title: "Admin",
  robots: { index: false },
};

/** v1: proves admin-only access; read-only catalog overview. */
export default async function AdminPage() {
  const { user } = await requireAdmin("/admin");
  const [products, categories] = await Promise.all([
    getProducts(defaultFilters),
    getCategories(),
  ]);
  const stats = [
    ["Products", products.length],
    ["Categories", categories.length],
    [
      "Sold out",
      products.filter((p) => getStockStatus(p.stock) === "sold-out").length,
    ],
    [
      "Low stock",
      products.filter((p) => getStockStatus(p.stock) === "low-stock").length,
    ],
  ] as const;

  return (
    <Container inset="tile" className="py-12 md:py-20">
      <h1 className="text-title">Admin</h1>
      <p className="text-body text-muted mt-2">Signed in as {user.email}.</p>
      <dl className="border-border mt-10 grid grid-cols-2 border-t md:grid-cols-4">
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
    </Container>
  );
}
