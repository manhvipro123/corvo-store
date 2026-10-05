import { cn } from "@/lib/utils";

const insets = {
  /** Responsive page gutter (16 → 24 → 64px). */
  page: "px-gutter",
  /**
   * Matches the caption inset of edge-to-edge tiles (16 → 24px). Use for
   * titles and controls sitting directly above a bleed `Grid` so they line up.
   */
  tile: "px-4 md:px-6",
  /** No horizontal padding, for edge-to-edge content. */
  bleed: "",
} as const;

/** Page-width wrapper with a horizontal inset. */
export function Container({
  inset = "page",
  className,
  ...props
}: React.ComponentProps<"div"> & { inset?: keyof typeof insets }) {
  return (
    <div
      className={cn("max-w-page mx-auto w-full", insets[inset], className)}
      {...props}
    />
  );
}
