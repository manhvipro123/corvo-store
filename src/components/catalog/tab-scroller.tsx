"use client";

import { useLayoutEffect, useRef } from "react";

import { cn } from "@/lib/utils";

/**
 * Horizontal scroller that brings the `aria-current` child into view, so the
 * active category is visible on narrow screens. Scrolls only this element,
 * never the page.
 */
export function TabScroller({
  className,
  children,
}: {
  className?: string;
  children: React.ReactNode;
}) {
  const ref = useRef<HTMLUListElement>(null);

  // Re-run whenever the rendered tabs change (i.e. the active one moves).
  useLayoutEffect(() => {
    const list = ref.current;
    const active = list?.querySelector<HTMLElement>("[aria-current]");
    if (!list || !active) return;
    const item = active.parentElement ?? active;
    const overflowRight = item.offsetLeft + item.offsetWidth - list.clientWidth;
    if (item.offsetLeft < list.scrollLeft || overflowRight > list.scrollLeft) {
      list.scrollLeft = Math.max(0, item.offsetLeft - 16);
    }
  });

  return (
    <ul ref={ref} className={cn("relative", className)}>
      {children}
    </ul>
  );
}
