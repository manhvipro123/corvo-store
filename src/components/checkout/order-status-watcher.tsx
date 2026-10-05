"use client";

import { useRouter } from "next/navigation";
import { useEffect, useState } from "react";

import { finishCheckout } from "@/app/checkout/actions";
import { notifyBagChange } from "@/components/bag/bag-count";
import type { OrderStatus } from "@/types/catalog";

const POLL_MS = 2500;
const GIVE_UP_MS = 60_000;

/**
 * Keeps the success page in step with the webhook. While the order is
 * pending it re-renders the page from the server every few seconds (the
 * page only reads our DB); once confirmed it empties the bag. Nothing here
 * can change the order's status.
 */
export function OrderStatusWatcher({ status }: { status: OrderStatus }) {
  const router = useRouter();
  const [slow, setSlow] = useState(false);

  useEffect(() => {
    if (status !== "pending") return;
    const poll = setInterval(() => router.refresh(), POLL_MS);
    const giveUp = setTimeout(() => {
      clearInterval(poll);
      setSlow(true);
    }, GIVE_UP_MS);
    return () => {
      clearInterval(poll);
      clearTimeout(giveUp);
    };
  }, [status, router]);

  useEffect(() => {
    if (status !== "paid" && status !== "processing") return;
    finishCheckout().then((cleared) => cleared && notifyBagChange());
  }, [status]);

  if (status !== "pending") return null;
  return (
    <p role="status" className="text-meta text-muted mt-4">
      {slow
        ? "This is taking longer than usual. You won't be charged twice; refresh this page in a minute."
        : "This page updates automatically."}
    </p>
  );
}
