"use client";

import { useEffect, useSyncExternalStore } from "react";

import { BAG_COUNT_COOKIE } from "@/lib/bag";

/**
 * Header item count, read from the client-readable count cookie so the
 * header (and every cached page) stays static. Bag actions set the cookie;
 * `notifyBagChange` tells this component to re-read it.
 */

const CHANGE_EVENT = "bag:change";

export function notifyBagChange() {
  window.dispatchEvent(new Event(CHANGE_EVENT));
}

function subscribe(onChange: () => void) {
  window.addEventListener(CHANGE_EVENT, onChange);
  // Another tab may have changed the bag.
  window.addEventListener("focus", onChange);
  return () => {
    window.removeEventListener(CHANGE_EVENT, onChange);
    window.removeEventListener("focus", onChange);
  };
}

function readCount() {
  const match = new RegExp(`(?:^|; )${BAG_COUNT_COOKIE}=(\\d+)`).exec(
    document.cookie,
  );
  return match ? Number(match[1]) : 0;
}

export function BagCount() {
  // Server render and hydration show no count; the client fills it in.
  const count = useSyncExternalStore(subscribe, readCount, () => 0);
  if (!count) return null;
  return (
    <span className="text-meta tabular-nums">
      {count}
      <span className="sr-only"> {count === 1 ? "item" : "items"}</span>
    </span>
  );
}

/**
 * Rendered by /bag with the count it just checked against live stock: pages
 * can't set cookies, so this corrects the header count from the client.
 */
export function BagCountSync({ count }: { count: number }) {
  useEffect(() => {
    const secure = location.protocol === "https:" ? "; secure" : "";
    document.cookie = count
      ? `${BAG_COUNT_COOKIE}=${count}; path=/; max-age=${60 * 60 * 24 * 30}; samesite=lax${secure}`
      : `${BAG_COUNT_COOKIE}=; path=/; max-age=0`;
    notifyBagChange();
  }, [count]);
  return null;
}
