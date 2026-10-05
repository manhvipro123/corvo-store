import Link from "next/link";
import { X } from "lucide-react";

import { TextLink } from "@/components/ui/text-link";
import { colors } from "@/lib/colors";
import {
  type CatalogFilters,
  filtersHref,
  sortLabel,
  toggleColor,
} from "@/lib/catalog";

/**
 * One status line above the grid: result count (for the search query, if
 * any) and current sort on the
 * left, removable colour chips on the right. Always the same height, so the
 * grid doesn't shift when filters are added or cleared.
 */
export function ActiveFilters({
  filters,
  resultCount,
}: {
  filters: CatalogFilters;
  resultCount: number;
}) {
  return (
    <div className="flex min-h-14 flex-wrap items-center justify-between gap-x-6 gap-y-3 py-3">
      <p className="text-meta text-muted tabular-nums" aria-live="polite">
        {resultCount}{" "}
        {filters.query
          ? `${resultCount === 1 ? "result" : "results"} for “${filters.query}”`
          : resultCount === 1
            ? "item"
            : "items"}
        <span className="max-sm:hidden"> · Sorted by {sortLabel(filters)}</span>
      </p>

      {filters.colors.length > 0 && (
        <div className="flex flex-wrap items-center gap-2">
          {filters.colors.map((slug) => (
            <Link
              key={slug}
              href={filtersHref(filters, {
                colors: toggleColor(filters, slug),
              })}
              scroll={false}
              aria-label={`Remove ${slug} filter`}
              className="text-meta border-border hover:border-foreground flex h-8 items-center gap-2 border px-3 transition-colors"
            >
              {colors.find((c) => c.slug === slug)?.label}
              <X className="size-3" strokeWidth={1.5} aria-hidden />
            </Link>
          ))}
          <TextLink
            variant="action"
            href={filtersHref(filters, { colors: [] })}
            scroll={false}
            className="ml-2"
          >
            Clear
          </TextLink>
        </div>
      )}
    </div>
  );
}
