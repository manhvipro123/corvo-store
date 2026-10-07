import Link from "next/link";

import { buttonVariants } from "@/components/ui/button";

/** The site's empty-state pattern, for admin lists. */
export function EmptyState({
  title,
  description,
  action,
}: {
  title: string;
  description?: string;
  action?: { label: string; href: string };
}) {
  return (
    <div className="flex flex-col items-start gap-4 pt-8">
      <p className="text-title">{title}</p>
      {description && (
        <p className="text-body text-muted max-w-prose">{description}</p>
      )}
      {action && (
        <Link
          href={action.href}
          className={buttonVariants({
            variant: "secondary",
            className: "mt-2",
          })}
        >
          {action.label}
        </Link>
      )}
    </div>
  );
}
