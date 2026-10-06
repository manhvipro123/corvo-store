import type { Metadata } from "next";
import Link from "next/link";
import { Search } from "lucide-react";

import { EmptyState } from "@/components/admin/empty-state";
import { FilterTabs } from "@/components/admin/filter-tabs";
import { InventoryStatusProvider } from "@/components/admin/inventory-status";
import { ReleaseHoldsForm } from "@/components/admin/release-holds-form";
import { StockForm } from "@/components/admin/stock-form";
import { ProductImage } from "@/components/product/product-image";
import { StockStatus } from "@/components/product/stock-status";
import { MediaFrame } from "@/components/ui/media-frame";
import { SectionHeader } from "@/components/ui/section-header";
import { TextLink } from "@/components/ui/text-link";
import { getCategories, getInventory, getInventoryCounts } from "@/db/queries";
import {
  adminHref,
  firstParam,
  inventoryFilters,
  parseInventoryFilter,
  parsePage,
} from "@/lib/admin";
import { normalizeQuery } from "@/lib/search";
import { requireAdmin } from "@/lib/session";

export const metadata: Metadata = { title: "Admin: Inventory" };

export default async function InventoryPage({
  searchParams,
}: PageProps<"/admin/inventory">) {
  await requireAdmin("/admin/inventory");
  const params = await searchParams;
  const categories = await getCategories();
  const status = parseInventoryFilter(firstParam(params, "status"));
  const category = categories.find(
    (c) => c.slug === firstParam(params, "category"),
  )?.slug;
  const query = normalizeQuery(params.q) || undefined;
  const page = parsePage(firstParam(params, "page"));
  const [{ rows, hasNextPage }, counts] = await Promise.all([
    getInventory({ status, category, query, page }),
    getInventoryCounts(),
  ]);

  /** This listing with `patch` applied; any filter change goes to page 1. */
  const href = (
    patch: Partial<Record<"status" | "category" | "q", string | undefined>>,
    nextPage = 1,
  ) =>
    adminHref("/admin/inventory", {
      status,
      category,
      q: query,
      ...patch,
      page: nextPage > 1 ? nextPage : undefined,
    });
  const filtered = Boolean(status || category || query);

  return (
    <section className="grid grid-cols-[minmax(0,1fr)]">
      <SectionHeader
        title="Inventory"
        description="Available is what can still be sold. Units in open checkouts were already deducted: on hold while the checkout is open, expired once it lapsed unpaid (they come back when released), processing while a delayed payment clears."
      />

      <InventoryStatusProvider>
        <ReleaseHoldsForm staleCheckouts={counts.staleHolds} />

        <form
          action="/admin/inventory"
          role="search"
          className="border-border mb-2 flex items-center gap-3 border-b"
        >
          {status && <input type="hidden" name="status" value={status} />}
          {category && <input type="hidden" name="category" value={category} />}
          <Search
            className="text-muted size-4 shrink-0"
            strokeWidth={1.5}
            aria-hidden
          />
          <label htmlFor="q" className="sr-only">
            Search inventory
          </label>
          <input
            id="q"
            name="q"
            type="search"
            defaultValue={query}
            placeholder="Search by name, SKU or slug"
            className="text-body h-12 min-w-0 flex-1 bg-transparent outline-none"
          />
        </form>
        <FilterTabs
          label="Stock status"
          tabs={inventoryFilters.map((f) => ({
            label: f.label,
            href: href({ status: f.value }),
            active: f.value === status,
          }))}
        />
        <FilterTabs
          label="Categories"
          tabs={[
            { slug: undefined, name: "All categories" },
            ...categories,
          ].map((c) => ({
            label: c.name,
            href: href({ category: c.slug }),
            active: c.slug === category,
          }))}
        />

        {rows.length === 0 ? (
          <EmptyState
            title={
              page > 1
                ? "No more products."
                : status === "sold-out" && !category && !query
                  ? "Nothing is sold out."
                  : "No products here."
            }
            description={
              query
                ? "Nothing matches that search. Check the spelling or try fewer words."
                : undefined
            }
            action={
              filtered || page > 1
                ? { label: "All inventory", href: "/admin/inventory" }
                : undefined
            }
          />
        ) : (
          <ul className="border-border border-t">
            {rows.map((row, i) => (
              <li
                key={row.id}
                className="border-border grid grid-cols-[3.5rem_minmax(0,1fr)] gap-x-4 gap-y-4 border-b py-5 md:grid-cols-[3.5rem_minmax(0,1fr)_9rem_minmax(0,18rem)] md:items-start"
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
                <dl className="text-meta col-start-2 grid grid-cols-2 gap-x-4 gap-y-1 md:col-start-auto md:grid-cols-1">
                  {(
                    [
                      ["Available", row.available],
                      ["On hold", row.onHold],
                      ["Expired holds", row.staleHolds],
                      ["Processing", row.processing],
                    ] as const
                  ).map(([label, value]) => (
                    <div key={label} className="flex gap-1">
                      <dt className="text-muted">{label}</dt>
                      <dd className="tabular-nums">{value}</dd>
                    </div>
                  ))}
                </dl>
                <div className="col-start-2 md:col-start-auto">
                  <StockForm
                    productId={row.id}
                    productName={row.name}
                    available={row.available}
                    onHold={row.onHold + row.staleHolds}
                  />
                </div>
              </li>
            ))}
          </ul>
        )}
      </InventoryStatusProvider>

      {(page > 1 || hasNextPage) && (
        <nav
          aria-label="Pages"
          className="text-meta flex items-center justify-between gap-4 pt-6"
        >
          {page > 1 ? (
            <TextLink href={href({}, page - 1)}>← Previous</TextLink>
          ) : (
            <span />
          )}
          <span className="text-muted">Page {page}</span>
          {hasNextPage ? (
            <TextLink href={href({}, page + 1)}>Next →</TextLink>
          ) : (
            <span />
          )}
        </nav>
      )}
    </section>
  );
}
