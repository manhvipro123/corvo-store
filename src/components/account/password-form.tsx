"use client";

import { Check, CircleAlert, LoaderCircle } from "lucide-react";
import { useActionState, useEffect, useRef, useState } from "react";

import { changePassword } from "@/app/account/actions";
import { Button } from "@/components/ui/button";
import {
  PASSWORD_MAX_LENGTH,
  PASSWORD_MIN_LENGTH,
  type PasswordChangeErrors,
  type PasswordChangeField,
  validatePasswordChange,
  validatePasswordChangeField,
} from "@/lib/auth-validation";
import { cn } from "@/lib/utils";

const FIELDS: {
  field: PasswordChangeField;
  label: string;
  autoComplete: string;
}[] = [
  {
    field: "currentPassword",
    label: "Current password",
    autoComplete: "current-password",
  },
  { field: "newPassword", label: "New password", autoComplete: "new-password" },
];

/**
 * Change-password form. Same field styling and validation behaviour as the
 * auth forms; React clears both fields after every submission, so nothing
 * typed survives a round trip.
 */
export function PasswordForm({ email }: { email: string }) {
  const [state, formAction, pending] = useActionState(changePassword, {});
  const inputs = useRef<
    Partial<Record<PasswordChangeField, HTMLInputElement | null>>
  >({});
  const [clientErrors, setClientErrors] = useState<PasswordChangeErrors>({});
  const [edited, setEdited] = useState(false);
  const [visible, setVisible] = useState<Set<PasswordChangeField>>(new Set());
  const [newLength, setNewLength] = useState(0);

  const errorFor = (field: PasswordChangeField) =>
    clientErrors[field] ?? (edited ? undefined : state.fieldErrors?.[field]);
  const formError = edited ? undefined : state.formError;
  const saved = !edited && state.saved;

  useEffect(() => {
    const first = FIELDS.find(({ field }) => state.fieldErrors?.[field]);
    if (first) inputs.current[first.field]?.focus();
  }, [state]);

  const check = (field: PasswordChangeField, value: string) =>
    validatePasswordChangeField(
      field,
      value,
      inputs.current.currentPassword?.value,
    );

  function onSubmit(event: React.FormEvent<HTMLFormElement>) {
    const data = new FormData(event.currentTarget);
    const errors = validatePasswordChange({
      currentPassword: String(data.get("currentPassword") ?? ""),
      newPassword: String(data.get("newPassword") ?? ""),
    });
    const first = FIELDS.find(({ field }) => errors[field]);
    if (first) {
      event.preventDefault();
      setClientErrors(errors);
      inputs.current[first.field]?.focus();
      return;
    }
    setClientErrors({});
    setEdited(false);
    setNewLength(0);
  }

  return (
    <form
      action={formAction}
      onSubmit={onSubmit}
      noValidate
      aria-busy={pending}
      className="flex flex-col gap-8"
    >
      {/* Tells password managers which account this password belongs to. */}
      <input
        type="email"
        name="username"
        autoComplete="username"
        value={email}
        readOnly
        hidden
      />

      {formError && (
        <div
          role="alert"
          className="border-foreground text-meta flex items-start gap-3 border px-4 py-3"
        >
          <CircleAlert
            className="mt-px size-4 shrink-0"
            strokeWidth={1.5}
            aria-hidden
          />
          <p>{formError}</p>
        </div>
      )}

      <fieldset disabled={pending} className="flex flex-col gap-8">
        {FIELDS.map(({ field, label, autoComplete }) => {
          const error = errorFor(field);
          const hint = field === "newPassword";
          const shown = visible.has(field);
          const describedBy =
            [error && `${field}-error`, hint && `${field}-hint`]
              .filter(Boolean)
              .join(" ") || undefined;

          return (
            <div key={field} className="flex flex-col gap-2">
              <label htmlFor={field} className="text-label">
                {label}
              </label>
              <div
                className={cn(
                  "flex items-center gap-3 border-b transition-colors",
                  error
                    ? "border-foreground"
                    : "border-border focus-within:border-foreground",
                )}
              >
                <input
                  ref={(el) => {
                    inputs.current[field] = el;
                  }}
                  id={field}
                  name={field}
                  type={shown ? "text" : "password"}
                  autoComplete={autoComplete}
                  maxLength={PASSWORD_MAX_LENGTH}
                  required
                  aria-invalid={Boolean(error)}
                  aria-describedby={describedBy}
                  onChange={(e) => {
                    const { value } = e.target;
                    if (hint) setNewLength(value.length);
                    setEdited(true);
                    if (clientErrors[field])
                      setClientErrors((prev) => ({
                        ...prev,
                        [field]: check(field, value),
                      }));
                  }}
                  onBlur={(e) => {
                    const { value } = e.currentTarget;
                    if (!value && !clientErrors[field]) return;
                    setClientErrors((prev) => ({
                      ...prev,
                      [field]: check(field, value),
                    }));
                  }}
                  className="text-body h-12 min-w-0 flex-1 bg-transparent outline-none disabled:opacity-60"
                />
                <button
                  type="button"
                  onClick={() =>
                    setVisible((prev) => {
                      const next = new Set(prev);
                      if (!next.delete(field)) next.add(field);
                      return next;
                    })
                  }
                  aria-pressed={shown}
                  aria-controls={field}
                  aria-label={`${shown ? "Hide" : "Show"} ${label.toLowerCase()}`}
                  className="text-label text-muted hover:text-foreground shrink-0 py-2 transition-colors"
                >
                  {shown ? "Hide" : "Show"}
                </button>
              </div>

              {hint && (
                <p
                  id={`${field}-hint`}
                  className={cn(
                    "text-meta flex items-center gap-2 transition-colors",
                    newLength >= PASSWORD_MIN_LENGTH
                      ? "text-foreground"
                      : "text-muted",
                  )}
                >
                  <Check
                    className={cn(
                      "size-3.5 transition-opacity",
                      newLength >= PASSWORD_MIN_LENGTH
                        ? "opacity-100"
                        : "opacity-30",
                    )}
                    strokeWidth={2}
                    aria-hidden
                  />
                  At least {PASSWORD_MIN_LENGTH} characters
                </p>
              )}

              {error && (
                <p
                  id={`${field}-error`}
                  className="text-meta flex items-start gap-2"
                >
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
        })}
      </fieldset>

      <div className="flex flex-col items-start gap-4 sm:flex-row sm:items-center">
        <Button type="submit" disabled={pending} className="w-full sm:w-auto">
          {pending && (
            <LoaderCircle
              className="size-4 animate-spin"
              strokeWidth={1.5}
              aria-hidden
            />
          )}
          {pending ? "Updating…" : "Update password"}
        </Button>
        <p role="status" className="text-meta flex items-center gap-2">
          {saved && (
            <>
              <Check className="size-3.5" strokeWidth={2} aria-hidden />
              Password updated. Other devices have been signed out.
            </>
          )}
        </p>
      </div>
    </form>
  );
}
