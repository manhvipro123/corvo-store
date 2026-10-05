import { cn } from "@/lib/utils";

const spacing = {
  sm: "py-6 md:py-8",
  md: "py-10 md:py-16",
  lg: "py-16 md:py-24",
} as const;

/** Vertical rhythm block; pair with `Container` for horizontal gutters. */
export function Section({
  spacing: size = "md",
  className,
  ...props
}: React.ComponentProps<"section"> & { spacing?: keyof typeof spacing }) {
  return <section className={cn(spacing[size], className)} {...props} />;
}
