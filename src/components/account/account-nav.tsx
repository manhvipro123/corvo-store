"use client";

import Link from "next/link";
import { usePathname } from "next/navigation";

import { TabScroller } from "@/components/catalog/tab-scroller";
import { siteConfig } from "@/config/site";
import { cn } from "@/lib/utils";

/**
 * Account section switcher: a scrolling tab row on small screens (like the
 * category tabs), a vertical list with a hairline rule from `lg` up. The
 * active item is marked by colour and a 1px rule over that hairline (drawn
 * as an inset shadow on mobile, since the scroller would clip a negative
 * margin).
 */
export function AccountNav({ showAdmin }: { showAdmin: boolean }) {
  const pathname = usePathname();
  const items = [
    ...siteConfig.accountNav,
    ...(showAdmin ? [{ label: "Admin", href: "/admin" }] : []),
  ];

  return (
    <nav aria-label="Account">
      <TabScroller className="lg:border-border flex scrollbar-none gap-6 overflow-x-auto max-lg:mask-r-from-85% max-lg:shadow-[inset_0_-1px_0_var(--color-border)] lg:flex-col lg:gap-0 lg:overflow-visible lg:border-l">
        {items.map((item) => {
          // Overview is the section root, so it only matches exactly.
          const active =
            item.href === "/account"
              ? pathname === item.href
              : pathname.startsWith(item.href);
          return (
            <li key={item.href} className="shrink-0">
              <Link
                href={item.href}
                aria-current={active ? "page" : undefined}
                className={cn(
                  "text-label block border-b py-4 whitespace-nowrap transition-colors",
                  "lg:-ml-px lg:border-b-0 lg:border-l lg:py-2.5 lg:pl-5",
                  active
                    ? "border-foreground"
                    : "text-muted hover:text-foreground border-transparent",
                )}
              >
                {item.label}
              </Link>
            </li>
          );
        })}
      </TabScroller>
    </nav>
  );
}
