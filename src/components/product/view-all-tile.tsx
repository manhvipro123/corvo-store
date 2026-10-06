import Link from "next/link";
import { ArrowRight } from "lucide-react";

import { cn } from "@/lib/utils";

/** Extra columns the tile takes so the last row of a 2/4-column grid is full. */
const lgSpan = ["", "lg:col-span-2", "lg:col-span-3", "lg:col-span-4"];

/**
 * Closing tile of a product row: "Shop all <collection>" with its size. It
 * sits in the grid after `cardCount` cards and stretches to fill the row, so
 * short collections never leave an empty slot.
 */
export function ViewAllTile({
  href,
  title,
  count,
  cardCount,
}: {
  href: string;
  title: string;
  count: number;
  cardCount: number;
}) {
  const tiles = cardCount + 1;
  const fillsMobileRow = tiles % 2 === 1;

  return (
    <li
      className={cn(
        fillsMobileRow && "col-span-2 lg:col-span-1",
        lgSpan[(4 - (tiles % 4)) % 4],
      )}
    >
      <Link
        href={href}
        className={cn(
          "group bg-surface hover:bg-foreground hover:text-background flex h-full flex-col justify-between gap-10 p-4 transition-colors duration-200 md:p-6",
          fillsMobileRow && "min-h-48",
        )}
      >
        <span className="text-label text-muted group-hover:text-background/70 transition-colors">
          Shop all
        </span>
        <span className="flex flex-col gap-2">
          <span className="text-title md:text-display">{title}</span>
          <span className="text-meta text-muted group-hover:text-background/70 flex items-center gap-2 transition-colors">
            {count} {count === 1 ? "piece" : "pieces"}
            <ArrowRight
              className="size-3.5 transition-transform duration-200 group-hover:translate-x-1"
              strokeWidth={1.5}
              aria-hidden
            />
          </span>
        </span>
      </Link>
    </li>
  );
}
