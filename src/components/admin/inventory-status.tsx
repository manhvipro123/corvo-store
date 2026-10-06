"use client";

import { Check } from "lucide-react";
import { createContext, useCallback, useContext, useState } from "react";

import { cn } from "@/lib/utils";

const AnnounceContext = createContext<((message: string) => void) | null>(null);

/**
 * Page-level live region for the inventory list. A row that is saved can
 * leave a filtered view (e.g. "Low stock") on the re-render, taking its own
 * message with it; this one stays.
 */
export function InventoryStatusProvider({
  children,
}: {
  children: React.ReactNode;
}) {
  const [message, setMessage] = useState("");
  const announce = useCallback((next: string) => setMessage(next), []);

  return (
    <AnnounceContext value={announce}>
      {/* Always in the DOM (live regions must exist before they change);
          only takes space once there is something to say. */}
      <p
        role="status"
        className={cn("text-meta flex items-center gap-2", message && "py-3")}
      >
        {message && (
          <>
            <Check className="size-3.5" strokeWidth={2} aria-hidden />
            {message}
          </>
        )}
      </p>
      {children}
    </AnnounceContext>
  );
}

/** The page's announcer, or null outside `InventoryStatusProvider`. */
export const useAnnounce = () => useContext(AnnounceContext);
