import { orderStatusLabel } from "@/lib/orders";
import { cn } from "@/lib/utils";
import type { OrderStatus as Status } from "@/types/catalog";

/**
 * Monochrome payment status, like `StockStatus`: filled dot = paid, dashed
 * = still in progress, hollow = not paid.
 */
export function OrderStatus({
  status,
  className,
}: {
  status: Status;
  className?: string;
}) {
  const paid = status === "paid";
  const inProgress = status === "processing" || status === "pending";

  return (
    <p
      className={cn(
        "text-meta flex items-center gap-2 whitespace-nowrap",
        !paid && !inProgress && "text-muted",
        className,
      )}
    >
      <span
        aria-hidden
        className={cn(
          "size-1.5 shrink-0 rounded-full border border-current",
          paid && "bg-current",
          inProgress && "border-dashed",
        )}
      />
      {orderStatusLabel[status]}
    </p>
  );
}
