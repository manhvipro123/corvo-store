import { Check, CircleAlert } from "lucide-react";

import { cn } from "@/lib/utils";

/**
 * Form field pieces in the account/auth form style: uppercase label, input
 * with only a bottom hairline, hint and error lines wired through
 * `aria-describedby`. Inputs stay plain elements; spread `fieldProps(...)`
 * on them and use `inputClass` for the look.
 */

export function fieldProps(id: string, error?: string, hasHint = false) {
  const describedBy = [error && `${id}-error`, hasHint && `${id}-hint`]
    .filter(Boolean)
    .join(" ");
  return {
    id,
    name: id,
    "aria-invalid": Boolean(error),
    "aria-describedby": describedBy || undefined,
  };
}

export function inputClass(error?: string, className?: string) {
  return cn(
    "text-body w-full border-b bg-transparent transition-colors outline-none disabled:opacity-60",
    error ? "border-foreground" : "border-border focus:border-foreground",
    className,
  );
}

export function Field({
  id,
  label,
  hint,
  error,
  className,
  children,
}: {
  id: string;
  label: string;
  hint?: string;
  error?: string;
  className?: string;
  children: React.ReactNode;
}) {
  return (
    <div className={cn("flex flex-col gap-2", className)}>
      <label htmlFor={id} className="text-label">
        {label}
      </label>
      {children}
      {hint && (
        <p id={`${id}-hint`} className="text-meta text-muted">
          {hint}
        </p>
      )}
      {error && (
        <p id={`${id}-error`} className="text-meta flex items-start gap-2">
          <CircleAlert
            className="mt-px size-3.5 shrink-0"
            strokeWidth={1.5}
            aria-hidden
          />
          {error}
        </p>
      )}
    </div>
  );
}

/** Problem with the submission as a whole. */
export function FormError({ message }: { message?: string }) {
  if (!message) return null;
  return (
    <div
      role="alert"
      className="border-foreground text-meta flex items-start gap-3 border px-4 py-3"
    >
      <CircleAlert
        className="mt-px size-4 shrink-0"
        strokeWidth={1.5}
        aria-hidden
      />
      <p>{message}</p>
    </div>
  );
}

/** Live region next to a submit button; shows `message` when `show`. */
export function FormStatus({
  show,
  message,
  className,
}: {
  show?: boolean;
  message: string;
  className?: string;
}) {
  return (
    <p
      role="status"
      className={cn("text-meta flex items-center gap-2", className)}
    >
      {show && (
        <>
          <Check className="size-3.5" strokeWidth={2} aria-hidden />
          {message}
        </>
      )}
    </p>
  );
}
