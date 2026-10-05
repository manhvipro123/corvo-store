import { TextLink } from "@/components/ui/text-link";
import { cn } from "@/lib/utils";

/**
 * Section title (and optional one-line description) on the left, optional
 * "view all" style action on the right.
 */
export function SectionHeader({
  title,
  description,
  action,
  className,
}: {
  title: string;
  description?: string;
  action?: { label: string; href: string };
  className?: string;
}) {
  return (
    <div
      className={cn(
        "mb-6 flex items-end justify-between gap-4 md:mb-8",
        className,
      )}
    >
      <div className="flex flex-col gap-1">
        <h2 className="text-heading">{title}</h2>
        {description && (
          <p className="text-meta text-muted max-w-prose">{description}</p>
        )}
      </div>
      {action && (
        <TextLink
          variant="action"
          href={action.href}
          className="shrink-0 whitespace-nowrap"
        >
          {action.label}
        </TextLink>
      )}
    </div>
  );
}
