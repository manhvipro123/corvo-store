import { cn } from "@/lib/utils";

const variants = {
  primary: "bg-foreground text-background hover:bg-foreground/80",
  secondary:
    "border border-foreground text-foreground hover:bg-foreground hover:text-background",
  // White fill for use on top of photography, in either color scheme.
  inverse: "bg-white text-black hover:bg-white/85",
} as const;

const sizes = {
  md: "h-12 px-6",
  sm: "h-10 px-4",
} as const;

type ButtonStyleProps = {
  variant?: keyof typeof variants;
  size?: keyof typeof sizes;
  fullWidth?: boolean;
};

/** Class names for a button; use on `<Link>` / `<a>` to make it look like one. */
export function buttonVariants({
  variant = "primary",
  size = "md",
  fullWidth = false,
  className,
}: ButtonStyleProps & { className?: string } = {}) {
  return cn(
    "text-label inline-flex items-center justify-center gap-2 transition-colors duration-200",
    "disabled:pointer-events-none disabled:opacity-40",
    variants[variant],
    sizes[size],
    fullWidth && "w-full",
    className,
  );
}

export function Button({
  variant,
  size,
  fullWidth,
  className,
  type = "button",
  ...props
}: React.ComponentProps<"button"> & ButtonStyleProps) {
  return (
    <button
      type={type}
      className={buttonVariants({ variant, size, fullWidth, className })}
      {...props}
    />
  );
}
