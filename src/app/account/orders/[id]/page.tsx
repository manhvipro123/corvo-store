import type { Metadata } from "next";
import { notFound } from "next/navigation";

import { OrderDate } from "@/components/account/order-date";
import { OrderStatus } from "@/components/account/order-status";
import { OrderSummary } from "@/components/checkout/order-summary";
import { TextLink } from "@/components/ui/text-link";
import { getOrderForUser } from "@/db/queries";
import {
  isHistoryStatus,
  isOrderId,
  orderNumber,
  orderStatusNote,
} from "@/lib/orders";
import { requireUser } from "@/lib/session";

export const metadata: Metadata = {
  title: "Order",
  robots: { index: false },
};

export default async function OrderPage({
  params,
}: PageProps<"/account/orders/[id]">) {
  const { id } = await params;
  const { user } = await requireUser(
    `/account/orders/${encodeURIComponent(id)}`,
  );
  if (!isOrderId(id)) notFound();
  // The query itself is scoped to the signed-in user, so another
  // customer's order id returns nothing and 404s like a missing one.
  const order = await getOrderForUser({ orderId: id }, user.id);
  if (!order || !isHistoryStatus(order.status)) notFound();

  return (
    <section>
      <TextLink variant="nav" href="/account/orders" className="text-muted">
        ← All orders
      </TextLink>

      <div className="mt-6 mb-8 flex flex-col gap-1">
        <h2 className="text-heading">Order {orderNumber(order.id)}</h2>
        <p className="text-meta text-muted">
          Placed on <OrderDate date={order.createdAt} dateStyle="long" />
          {order.email && <> · Confirmation to {order.email}</>}
        </p>
      </div>

      <div className="border-border mb-8 flex flex-col gap-2 border px-4 py-4">
        <h3 className="text-label">Status</h3>
        <OrderStatus status={order.status} />
        <p className="text-meta text-muted">{orderStatusNote[order.status]}</p>
      </div>

      <OrderSummary order={order} />
    </section>
  );
}
