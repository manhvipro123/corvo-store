import Link from "next/link";

import { TabScroller } from "@/components/catalog/tab-scroller";
import { cn } from "@/lib/utils";

/**
 * Row of filter links in the category-tab style, sitting on a hairline.
 * Wrap it in a `grid-cols-[minmax(0,1fr)]` (or `min-w-0`) parent so the
 * scroller can't widen the page on mobile.
 */
export function FilterTabs({
  label,
  tabs,
  className,
}: {
  label: string;
  tabs: { label: string; href: string; active: boolean }[];
  className?: string;
}) {
  return (
    <nav
      aria-label={label}
      className={cn("border-border min-w-0 border-b", className)}
    >
      <TabScroller className="flex scrollbar-none items-center gap-6 overflow-x-auto max-lg:mask-r-from-85%">
        {tabs.map((tab) => (
          <li key={tab.href} className="shrink-0">
            <Link
              href={tab.href}
              scroll={false}
              aria-current={tab.active ? "page" : undefined}
              className={cn(
                "text-label -mb-px block border-b py-4 whitespace-nowrap transition-colors",
                tab.active
                  ? "border-foreground"
                  : "text-muted hover:text-foreground border-transparent",
              )}
            >
              {tab.label}
            </Link>
          </li>
        ))}
      </TabScroller>
    </nav>
  );
}
