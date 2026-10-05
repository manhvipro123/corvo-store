import { TextLink } from "@/components/ui/text-link";
import { cn } from "@/lib/utils";

/** Section title on the left, optional "view all" style action on the right. */
export function SectionHeader({
  title,
  action,
  className,
}: {
  title: string;
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
      <h2 className="text-heading">{title}</h2>
      {action && (
        <TextLink variant="action" href={action.href}>
          {action.label}
        </TextLink>
      )}
    </div>
  );
}
