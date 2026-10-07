import Link from "next/link";

import { OrderDate } from "@/components/account/order-date";
import { orderNumber } from "@/lib/orders";
import type { StockMovement } from "@/types/admin";

const reasonLabel: Record<StockMovement["reason"], string> = {
  initial: "Starting stock",
  admin_set: "Set by admin",
  admin_adjust: "Adjusted by admin",
  reserve: "Reserved by checkout",
  release: "Returned from checkout",
};

/** A product's latest stock changes, newest first. */
export function StockHistory({ movements }: { movements: StockMovement[] }) {
  if (!movements.length)
    return <p className="text-meta text-muted">No stock changes yet.</p>;

  return (
    <ol className="border-border border-t">
      {movements.map((m) => (
        <li
          key={m.id}
          className="border-border grid grid-cols-[minmax(0,1fr)_auto] gap-x-6 gap-y-1 border-b py-3 sm:grid-cols-[11rem_minmax(0,1fr)_4rem_4rem]"
        >
          <span className="text-meta text-muted">
            <OrderDate date={m.createdAt} timeStyle="short" />
          </span>
          <span className="text-meta col-start-1 min-w-0 sm:col-start-auto">
            {reasonLabel[m.reason]}
            {m.actorName && ` · ${m.actorName}`}
            {m.orderId && (
              <>
                {" · "}
                <Link
                  href={`/admin/orders/${m.orderId}`}
                  className="underline underline-offset-2 hover:opacity-70"
                >
                  Order {orderNumber(m.orderId)}
                </Link>
              </>
            )}
            {m.note && <span className="text-muted block">{m.note}</span>}
          </span>
          <span className="text-meta col-start-2 row-start-1 text-right font-medium tabular-nums sm:col-start-auto sm:row-start-auto">
            <span className="sr-only">Change </span>
            {m.delta > 0 ? `+${m.delta}` : `−${-m.delta}`}
          </span>
          <span className="text-meta text-muted col-start-2 text-right tabular-nums sm:col-start-auto">
            <span className="sr-only">Stock after </span>
            {m.quantityAfter}
          </span>
        </li>
      ))}
    </ol>
  );
}
