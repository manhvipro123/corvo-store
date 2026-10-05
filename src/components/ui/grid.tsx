import { cn } from "@/lib/utils";

/**
 * Edge-to-edge tile grid separated by 1px gaps: 2 columns on mobile,
 * 4 from `lg` up (no 3-column step, so rows of 4 never leave orphans).
 */
export function Grid({ className, ...props }: React.ComponentProps<"ul">) {
  return (
    <ul
      className={cn("grid grid-cols-2 gap-px lg:grid-cols-4", className)}
      {...props}
    />
  );
}
