import { cn } from "@/lib/utils";

const ratios = {
  portrait: "aspect-[3/4]",
  square: "aspect-square",
  landscape: "aspect-[16/9]",
} as const;

/**
 * Fixed-ratio box on the surface color. Children (e.g. `next/image` with
 * `fill`) are positioned to cover it.
 */
export function MediaFrame({
  ratio = "portrait",
  className,
  ...props
}: React.ComponentProps<"div"> & { ratio?: keyof typeof ratios }) {
  return (
    <div
      className={cn(
        "bg-surface relative overflow-hidden",
        ratios[ratio],
        className,
      )}
      {...props}
    />
  );
}
