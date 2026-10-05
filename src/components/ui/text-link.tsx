import Link from "next/link";

import { cn } from "@/lib/utils";

const variants = {
  // Mixed-case navigation; underline appears on hover.
  nav: "text-meta font-medium underline-offset-4 hover:underline",
  // Uppercase standalone action, always underlined.
  action: "text-label underline underline-offset-4 hover:opacity-70",
  // Inline link inside running text.
  inline: "underline underline-offset-2 hover:opacity-70",
} as const;

export function TextLink({
  variant = "nav",
  className,
  ...props
}: React.ComponentProps<typeof Link> & { variant?: keyof typeof variants }) {
  return (
    <Link
      className={cn("transition-opacity", variants[variant], className)}
      {...props}
    />
  );
}
