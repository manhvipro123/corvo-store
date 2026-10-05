import Link from "next/link";

import { TabScroller } from "@/components/catalog/tab-scroller";
import { type CatalogFilters, filtersHref } from "@/lib/catalog";
import { cn } from "@/lib/utils";
import type { Category } from "@/types/catalog";

/**
 * Horizontally scrolling category switcher. All tabs share one type style so
 * widths never jump; the active tab is marked by colour and a 1px rule that
 * sits on the toolbar's bottom border. Below `lg` the right edge fades out
 * to hint that the row scrolls.
 */
export function CategoryTabs({
  categories,
  filters,
}: {
  categories: Category[];
  filters: CatalogFilters;
}) {
  const tabs = [
    { slug: undefined, label: "All" },
    ...categories.map((c) => ({ slug: c.slug, label: c.name })),
  ];

  return (
    <nav aria-label="Categories" className="min-w-0 flex-1">
      <TabScroller className="flex scrollbar-none items-center gap-6 overflow-x-auto max-lg:mask-r-from-85%">
        {tabs.map((tab) => {
          const active = filters.category === tab.slug;
          return (
            <li key={tab.label} className="shrink-0">
              <Link
                href={filtersHref(filters, { category: tab.slug })}
                scroll={false}
                aria-current={active ? "page" : undefined}
                className={cn(
                  "text-label block border-b py-4 whitespace-nowrap transition-colors",
                  active
                    ? "border-foreground"
                    : "text-muted hover:text-foreground border-transparent",
                )}
              >
                {tab.label}
              </Link>
            </li>
          );
        })}
      </TabScroller>
    </nav>
  );
}
