import type { Metadata } from "next";
import Link from "next/link";

import { EmptyState } from "@/components/admin/empty-state";
import { FilterTabs } from "@/components/admin/filter-tabs";
import { StockForm } from "@/components/admin/stock-form";
import { ProductImage } from "@/components/product/product-image";
import { StockStatus } from "@/components/product/stock-status";
import { MediaFrame } from "@/components/ui/media-frame";
import { SectionHeader } from "@/components/ui/section-header";
import { getInventory } from "@/db/queries";
import {
  adminHref,
  firstParam,
  inventoryFilters,
  parseInventoryFilter,
} from "@/lib/admin";
import { requireAdmin } from "@/lib/session";

export const metadata: Metadata = { title: "Admin: Inventory" };

export default async function InventoryPage({
  searchParams,
}: PageProps<"/admin/inventory">) {
  await requireAdmin("/admin/inventory");
  const status = parseInventoryFilter(firstParam(await searchParams, "status"));
  const rows = await getInventory({ status });

  return (
    <section className="grid grid-cols-[minmax(0,1fr)]">
      <SectionHeader
        title="Inventory"
        description="Available is what can still be sold. Units in open checkouts are already deducted and shown as on hold; they come back if the checkout ends unpaid."
      />
      <FilterTabs
        label="Stock status"
        tabs={inventoryFilters.map((f) => ({
          label: f.label,
          href: adminHref("/admin/inventory", { status: f.value }),
          active: f.value === status,
        }))}
      />

      {rows.length === 0 ? (
        <EmptyState
          title={
            status === "sold-out" ? "Nothing is sold out." : "No products here."
          }
          description={
            status === "low-stock"
              ? "No product is running low right now."
              : undefined
          }
          action={{ label: "All inventory", href: "/admin/inventory" }}
        />
      ) : (
        <ul>
          {rows.map((row, i) => (
            <li
              key={row.id}
              id={`product-${row.id}`}
              className="border-border target:bg-surface grid scroll-mt-24 grid-cols-[3.5rem_minmax(0,1fr)] gap-x-4 gap-y-4 border-b py-5 md:grid-cols-[3.5rem_minmax(0,1fr)_7rem_auto] md:items-start"
            >
              <MediaFrame>
                <ProductImage
                  image={row.image}
                  sizes="56px"
                  loading={i < 8 ? "eager" : undefined}
                />
              </MediaFrame>
              <div className="flex min-w-0 flex-col gap-1">
                <Link
                  href={`/admin/products/${row.id}`}
                  className="text-meta truncate font-medium underline-offset-2 hover:underline"
                >
                  {row.name}
                </Link>
                <span className="text-meta text-muted truncate">
                  {row.sku} · {row.categoryName}
                </span>
                <StockStatus stock={row.available} className="mt-1" />
              </div>
              <dl className="text-meta col-start-2 flex gap-4 md:col-start-auto md:flex-col md:gap-1">
                <div className="flex gap-1">
                  <dt className="text-muted">Available</dt>
                  <dd className="tabular-nums">{row.available}</dd>
                </div>
                <div className="flex gap-1">
                  <dt className="text-muted">On hold</dt>
                  <dd className="tabular-nums">{row.onHold}</dd>
                </div>
              </dl>
              <div className="col-start-2 md:col-start-auto">
                <StockForm
                  productId={row.id}
                  productName={row.name}
                  available={row.available}
                />
              </div>
            </li>
          ))}
        </ul>
      )}
    </section>
  );
}
