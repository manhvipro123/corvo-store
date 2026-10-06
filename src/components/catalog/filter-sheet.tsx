"use client";

import Link from "next/link";
import { useRef } from "react";
import { Check, SlidersHorizontal, X } from "lucide-react";

import { Button } from "@/components/ui/button";
import { TextLink } from "@/components/ui/text-link";
import { colors } from "@/lib/colors";
import {
  type CatalogFilters,
  filtersHref,
  sortLabel,
  sortOptions,
  toggleColor,
} from "@/lib/catalog";
import { cn } from "@/lib/utils";

/**
 * "Filter & sort" trigger plus a side sheet built on <dialog>, which gives
 * focus trapping, Esc-to-close and a backdrop for free. Options are plain
 * links, so every state is a shareable URL; the sheet stays open while
 * results update behind it.
 */
export function FilterSheet({
  filters,
  resultCount,
}: {
  filters: CatalogFilters;
  resultCount: number;
}) {
  const dialogRef = useRef<HTMLDialogElement>(null);
  const activeCount =
    filters.colors.length + (filters.sort !== "recommended" ? 1 : 0);

  return (
    <>
      <button
        type="button"
        onClick={() => dialogRef.current?.showModal()}
        aria-label={
          activeCount
            ? `Filter and sort, ${activeCount} active`
            : "Filter and sort"
        }
        className="text-meta flex shrink-0 items-center gap-2 py-4 font-medium underline-offset-4 hover:underline"
      >
        <SlidersHorizontal className="size-4" strokeWidth={1.5} aria-hidden />
        <span aria-hidden>
          <span className="max-sm:hidden">Filter and sort</span>
          <span className="sm:hidden">Filter</span>
          {activeCount > 0 && (
            <span className="tabular-nums"> ({activeCount})</span>
          )}
        </span>
      </button>

      <dialog
        ref={dialogRef}
        aria-labelledby="filter-sheet-title"
        // Clicking the backdrop (the dialog element itself) closes it.
        onClick={(e) => e.target === e.currentTarget && e.currentTarget.close()}
        className="bg-background text-foreground backdrop:bg-overlay m-0 ml-auto h-dvh max-h-none w-full max-w-md p-0"
      >
        <div className="flex h-full flex-col">
          <header className="border-border px-gutter h-header flex shrink-0 items-center justify-between border-b md:px-8">
            <h2 id="filter-sheet-title" className="text-heading">
              Filter and sort
            </h2>
            <button
              type="button"
              onClick={() => dialogRef.current?.close()}
              aria-label="Close"
              className="-mr-2 p-2"
            >
              <X className="size-5" strokeWidth={1.5} />
            </button>
          </header>

          <div className="px-gutter flex-1 overflow-y-auto py-8 md:px-8">
            <section aria-labelledby="sort-heading">
              <h3 id="sort-heading" className="text-label mb-4">
                Sort by
              </h3>
              <ul className="flex flex-col">
                {sortOptions.map((option) => {
                  const active = filters.sort === option.value;
                  return (
                    <li key={option.value}>
                      <Link
                        href={filtersHref(filters, { sort: option.value })}
                        scroll={false}
                        replace
                        aria-current={active ? "true" : undefined}
                        className="text-body flex items-center justify-between py-2"
                      >
                        <span className={cn(!active && "text-muted")}>
                          {sortLabel({ ...filters, sort: option.value })}
                        </span>
                        {active && (
                          <Check className="size-4" strokeWidth={1.5} />
                        )}
                      </Link>
                    </li>
                  );
                })}
              </ul>
            </section>

            <section
              aria-labelledby="color-heading"
              className="border-border mt-8 border-t pt-8"
            >
              <h3 id="color-heading" className="text-label mb-4">
                Color
              </h3>
              <ul className="grid grid-cols-2 gap-x-4 gap-y-1">
                {colors.map((color) => {
                  const active = filters.colors.includes(color.slug);
                  return (
                    <li key={color.slug}>
                      <Link
                        href={filtersHref(filters, {
                          colors: toggleColor(filters, color.slug),
                        })}
                        scroll={false}
                        replace
                        aria-label={`${color.label}${active ? ", selected" : ""}`}
                        className="text-body flex items-center gap-3 py-2"
                      >
                        <span
                          className={cn(
                            "border-border size-5 shrink-0 border",
                            active &&
                              "outline-foreground outline outline-offset-2",
                          )}
                          style={{ backgroundColor: color.swatch }}
                          aria-hidden
                        />
                        <span className={cn(!active && "text-muted")}>
                          {color.label}
                        </span>
                      </Link>
                    </li>
                  );
                })}
              </ul>
            </section>
          </div>

          <footer className="border-border px-gutter flex shrink-0 items-center gap-6 border-t py-4 md:px-8">
            <TextLink
              variant="action"
              href={filtersHref(filters, { colors: [], sort: "recommended" })}
              scroll={false}
              replace
              className={cn(
                activeCount === 0 && "pointer-events-none opacity-30",
              )}
            >
              Clear all
            </TextLink>
            <Button
              className="flex-1"
              onClick={() => dialogRef.current?.close()}
            >
              Show {resultCount} {resultCount === 1 ? "result" : "results"}
            </Button>
          </footer>
        </div>
      </dialog>
    </>
  );
}
