import { getStockStatus, stockLabel } from "@/lib/catalog";
import { cn } from "@/lib/utils";

/**
 * Monochrome availability line: filled dot = available, hollow dot = sold
 * out. Low stock is called out in text rather than colour.
 */
export function StockStatus({
  stock,
  className,
}: {
  stock: number;
  className?: string;
}) {
  const status = getStockStatus(stock);
  const label = stockLabel(stock);

  return (
    <p
      className={cn(
        "text-meta flex items-center gap-2",
        status === "sold-out" && "text-muted",
        className,
      )}
    >
      <span
        aria-hidden
        className={cn(
          "size-1.5 rounded-full border border-current",
          status !== "sold-out" && "bg-current",
        )}
      />
      {label}
    </p>
  );
}
