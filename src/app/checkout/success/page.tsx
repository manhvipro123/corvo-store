import type { Metadata } from "next";
import { Check, CircleAlert, LoaderCircle } from "lucide-react";
import Link from "next/link";
import { notFound } from "next/navigation";

import { OrderStatusWatcher } from "@/components/checkout/order-status-watcher";
import { OrderSummary } from "@/components/checkout/order-summary";
import { buttonVariants } from "@/components/ui/button";
import { Container } from "@/components/ui/container";
import { TextLink } from "@/components/ui/text-link";
import { getOrderForUser } from "@/db/queries";
import { orderNumber } from "@/lib/orders";
import { requireUser } from "@/lib/session";
import { cn } from "@/lib/utils";
import type { OrderStatus } from "@/types/catalog";
export const metadata: Metadata = {
  title: "Order",
  robots: { index: false },
};

const copy: Record<
  OrderStatus,
  { title: string; body: string; icon: "done" | "wait" | "problem" }
> = {
  paid: {
    title: "Thank you for your order",
    body: "Your payment is confirmed and your pieces are being prepared.",
    icon: "done",
  },
  processing: {
    title: "Order placed",
    body: "Your payment is still clearing. We'll confirm your order as soon as it does; your pieces are held for you.",
    icon: "wait",
  },
  pending: {
    title: "Confirming your payment",
    body: "We're waiting for Stripe to confirm your payment. This usually takes a few seconds.",
    icon: "wait",
  },
  failed: {
    title: "Payment didn't go through",
    body: "Your bank declined or reversed the payment, so the order was cancelled and you haven't been charged. Your bag is still saved.",
    icon: "problem",
  },
  expired: {
    title: "Checkout ended",
    body: "This checkout ended before payment, so you haven't been charged. Your bag is still saved.",
    icon: "problem",
  },
};

const icons = {
  done: Check,
  wait: LoaderCircle,
  problem: CircleAlert,
};

/**
 * Stripe's success redirect lands here. It only reads the order (status is
 * set by the webhook, never by this redirect) and must belong to the user.
 */
export default async function CheckoutSuccessPage({
  searchParams,
}: PageProps<"/checkout/success">) {
  const { session_id } = await searchParams;
  const sessionId = typeof session_id === "string" ? session_id : "";
  const { user } = await requireUser(
    `/checkout/success?session_id=${encodeURIComponent(sessionId)}`,
  );
  const order = /^cs_\w+$/.test(sessionId)
    ? await getOrderForUser({ sessionId }, user.id)
    : undefined;
  if (!order) notFound();

  const { title, body, icon } = copy[order.status];
  const Icon = icons[icon];
  const ended = order.status === "failed" || order.status === "expired";

  return (
    <Container inset="tile" className="py-12 md:py-20">
      <div className="max-w-2xl">
        <div className="flex items-start gap-3">
          <Icon
            className={cn(
              "mt-1 size-4 shrink-0",
              icon === "wait" && "animate-spin",
            )}
            strokeWidth={1.5}
            aria-hidden
          />
          <div>
            <h1 className="text-title">{title}</h1>
            <p className="text-body text-muted mt-2">{body}</p>
          </div>
        </div>
        <OrderStatusWatcher status={order.status} />
        <p className="text-meta text-muted mt-6">
          Order {orderNumber(order.id)}
          {order.email && <> · Confirmation to {order.email}</>}
        </p>

        <div className="mt-10">
          <OrderSummary order={order} />
        </div>

        <div className="mt-10 flex flex-col gap-4 sm:flex-row sm:items-center sm:gap-8">
          {ended ? (
            <Link
              href="/bag"
              className={buttonVariants({ className: "w-full sm:w-auto" })}
            >
              Return to bag
            </Link>
          ) : (
            <TextLink variant="action" href="/products">
              Continue shopping
            </TextLink>
          )}
        </div>
      </div>
    </Container>
  );
}
