import type { Metadata } from "next";
import Link from "next/link";
import { ChevronRight } from "lucide-react";

import { OrderDate } from "@/components/account/order-date";
import { OrderStatus } from "@/components/account/order-status";
import { buttonVariants } from "@/components/ui/button";
import { SectionHeader } from "@/components/ui/section-header";
import { getOrdersForUser } from "@/db/queries";
import { formatPrice } from "@/lib/format";
import { orderNumber } from "@/lib/orders";
import { requireUser } from "@/lib/session";

export const metadata: Metadata = {
  title: "Orders",
  robots: { index: false },
};

export default async function OrdersPage() {
  const { user } = await requireUser("/account/orders");
  const orders = await getOrdersForUser(user.id);

  return (
    <section>
      <SectionHeader title="Orders" description="Your orders, newest first." />

      {orders.length === 0 ? (
        // Same empty-state pattern as the catalog pages.
        <div className="border-border flex flex-col items-start gap-4 border-t pt-8">
          <p className="text-title">No orders yet.</p>
          <p className="text-body text-muted max-w-prose">
            Orders you place will appear here with their status.
          </p>
          <Link
            href="/products"
            className={buttonVariants({
              variant: "secondary",
              className: "mt-2",
            })}
          >
            Shop all
          </Link>
        </div>
      ) : (
        <ul className="border-border border-t">
          {orders.map((order) => (
            <li key={order.id} className="border-border border-b">
              <Link
                href={`/account/orders/${order.id}`}
                className="group grid grid-cols-[1fr_auto] items-center gap-x-6 gap-y-2 py-5 sm:grid-cols-[1fr_auto_auto_auto]"
              >
                <div className="col-start-1 row-start-1 flex flex-col gap-1">
                  <span className="text-label">
                    Order {orderNumber(order.id)}
                  </span>
                  <span className="text-meta text-muted">
                    <OrderDate date={order.createdAt} /> · {order.itemCount}{" "}
                    {order.itemCount === 1 ? "item" : "items"}
                  </span>
                </div>
                <OrderStatus
                  status={order.status}
                  className="col-start-1 row-start-2 sm:col-start-2 sm:row-start-1"
                />
                <span className="text-body col-start-2 row-start-1 text-right font-medium tabular-nums sm:col-start-3">
                  {formatPrice(order.totalCents)}
                </span>
                <span className="text-meta text-muted group-hover:text-foreground col-start-2 row-start-2 flex items-center justify-end gap-1 transition-colors sm:col-start-4 sm:row-start-1">
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
    </section>
  );
}
