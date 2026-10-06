import type { Metadata } from "next";
import { notFound } from "next/navigation";

import { OrderDate } from "@/components/account/order-date";
import { OrderStatus } from "@/components/account/order-status";
import { OrderSummary } from "@/components/checkout/order-summary";
import { TextLink } from "@/components/ui/text-link";
import { getAdminOrder } from "@/db/queries";
import { isOrderId, orderNumber } from "@/lib/orders";
import { requireAdmin } from "@/lib/session";

export const metadata: Metadata = { title: "Admin: Order" };

export default async function AdminOrderPage({
  params,
}: PageProps<"/admin/orders/[id]">) {
  const { id } = await params;
  await requireAdmin(`/admin/orders/${encodeURIComponent(id)}`);
  if (!isOrderId(id)) notFound();
  const order = await getAdminOrder(id);
  if (!order) notFound();

  const details: [string, React.ReactNode][] = [
    ["Customer", order.customer.name],
    ["Account email", order.customer.email],
    ["Receipt email", order.email ?? "—"],
    [
      "Paid",
      order.paidAt ? (
        <OrderDate key="paid" date={order.paidAt} dateStyle="long" />
      ) : (
        "—"
      ),
    ],
    [
      order.status === "pending" ? "Reservation ends" : "Checkout expiry",
      <OrderDate key="expires" date={order.expiresAt} dateStyle="long" />,
    ],
    ["Checkout Session", order.stripeCheckoutSessionId ?? "—"],
    ["Payment Intent", order.stripePaymentIntentId ?? "—"],
  ];

  return (
    <section>
      <TextLink variant="nav" href="/admin/orders" className="text-muted">
        ← All orders
      </TextLink>

      <div className="mt-6 mb-8 flex flex-col gap-1">
        <h2 className="text-heading">Order {orderNumber(order.id)}</h2>
        <p className="text-meta text-muted">
          Placed on <OrderDate date={order.createdAt} dateStyle="long" />
        </p>
      </div>

      <div className="border-border mb-8 flex flex-col gap-2 border px-4 py-4">
        <h3 className="text-label">Payment status</h3>
        <OrderStatus status={order.status} />
        {order.needsReconcile && (
          <p className="text-meta text-muted max-w-prose">
            Stripe reports this checkout as completed, but its payment webhook
            never arrived, so it still holds stock. Resend the events for the
            Checkout Session below from the Stripe Dashboard to settle it.
          </p>
        )}
      </div>

      <dl className="border-border mb-10 border-t">
        {details.map(([label, value]) => (
          <div
            key={label}
            className="border-border flex flex-col gap-1 border-b py-3 sm:flex-row sm:justify-between sm:gap-6"
          >
            <dt className="text-meta text-muted shrink-0">{label}</dt>
            <dd className="text-meta min-w-0 break-all sm:text-right">
              {value}
            </dd>
          </div>
        ))}
      </dl>

      <OrderSummary order={order} />
    </section>
  );
}
