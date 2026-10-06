import type { Metadata } from "next";
import Link from "next/link";
import { ChevronRight } from "lucide-react";

import { OrderDate } from "@/components/account/order-date";
import { OrderStatus } from "@/components/account/order-status";
import { EmptyState } from "@/components/admin/empty-state";
import { FilterTabs } from "@/components/admin/filter-tabs";
import { TextLink } from "@/components/ui/text-link";
import { SectionHeader } from "@/components/ui/section-header";
import { getAdminOrders } from "@/db/queries";
import {
  adminHref,
  firstParam,
  orderFilterStatuses,
  orderFilters,
  parseOrderFilter,
  parsePage,
} from "@/lib/admin";
import { formatPrice } from "@/lib/format";
import { orderNumber } from "@/lib/orders";
import { requireAdmin } from "@/lib/session";
import type { AdminOrderFilter } from "@/types/admin";

export const metadata: Metadata = { title: "Admin: Orders" };

/** The default filter and first page stay out of the URL. */
const ordersHref = (filter: AdminOrderFilter, page = 1) =>
  adminHref("/admin/orders", {
    status: filter === "placed" ? undefined : filter,
    page: page > 1 ? page : undefined,
  });

export default async function AdminOrdersPage({
  searchParams,
}: PageProps<"/admin/orders">) {
  await requireAdmin("/admin/orders");
  const params = await searchParams;
  const filter = parseOrderFilter(firstParam(params, "status"));
  const page = parsePage(firstParam(params, "page"));
  const { orders, hasNextPage } = await getAdminOrders({
    statuses: orderFilterStatuses(filter),
    page,
  });

  return (
    <section className="grid grid-cols-[minmax(0,1fr)]">
      <SectionHeader
        title="Orders"
        description="Every customer's orders, newest first. Payment status comes from Stripe and can't be changed here."
      />
      <FilterTabs
        label="Order status"
        tabs={orderFilters.map((f) => ({
          label: f.label,
          href: ordersHref(f.value),
          active: f.value === filter,
        }))}
      />

      {orders.length === 0 ? (
        <EmptyState
          title="No orders here."
          description={
            page > 1
              ? "There are no more orders on this page."
              : "Orders with this status will appear here."
          }
          action={
            page > 1 || filter !== "placed"
              ? { label: "All placed orders", href: "/admin/orders" }
              : undefined
          }
        />
      ) : (
        <ul>
          {orders.map((order) => (
            <li key={order.id} className="border-border border-b">
              <Link
                href={`/admin/orders/${order.id}`}
                className="group grid grid-cols-[minmax(0,1fr)_auto] items-center gap-x-6 gap-y-2 py-5 md:grid-cols-[minmax(0,1fr)_minmax(0,1fr)_10rem_6rem_3rem]"
              >
                <div className="flex flex-col gap-1">
                  <span className="text-label">
                    Order {orderNumber(order.id)}
                  </span>
                  <span className="text-meta text-muted">
                    <OrderDate date={order.createdAt} /> · {order.itemCount}{" "}
                    {order.itemCount === 1 ? "item" : "items"}
                  </span>
                </div>
                <div className="text-meta col-start-1 flex min-w-0 flex-col gap-1 md:col-start-auto">
                  <span className="truncate">{order.customerName}</span>
                  <span className="text-muted truncate">
                    {order.customerEmail}
                  </span>
                </div>
                <OrderStatus
                  status={order.status}
                  className="col-start-1 md:col-start-auto"
                />
                <span className="text-body col-start-2 row-start-1 text-right font-medium tabular-nums md:col-start-auto md:row-start-auto">
                  {formatPrice(order.totalCents)}
                </span>
                <span className="text-meta text-muted group-hover:text-foreground col-start-2 row-start-2 flex items-center justify-end gap-1 transition-colors md:col-start-auto md:row-start-auto">
                  View
                  <ChevronRight
                    className="size-3.5"
                    strokeWidth={1.5}
                    aria-hidden
                  />
                </span>
              </Link>
            </li>
          ))}
        </ul>
      )}

      {(page > 1 || hasNextPage) && (
        <nav
          aria-label="Pages"
          className="text-meta flex items-center justify-between gap-4 pt-6"
        >
          {page > 1 ? (
            <TextLink href={ordersHref(filter, page - 1)}>← Newer</TextLink>
          ) : (
            <span />
          )}
          <span className="text-muted">Page {page}</span>
          {hasNextPage ? (
            <TextLink href={ordersHref(filter, page + 1)}>Older →</TextLink>
          ) : (
            <span />
          )}
        </nav>
      )}
    </section>
  );
}
