"use client";

import { Check, CircleAlert, LoaderCircle } from "lucide-react";
import { useActionState, useEffect, useRef, useState } from "react";

import type { AuthFormState } from "@/app/(auth)/actions";
import { Button } from "@/components/ui/button";
import {
  type AuthField,
  type AuthMode,
  EMAIL_MAX_LENGTH,
  type FieldErrors,
  NAME_MAX_LENGTH,
  PASSWORD_MAX_LENGTH,
  PASSWORD_MIN_LENGTH,
  fieldsFor,
  validateAuthForm,
  validateField,
} from "@/lib/auth-validation";
import { cn } from "@/lib/utils";

const FIELD_META: Record<
  AuthField,
  { label: string; type: string; maxLength: number }
> = {
  name: { label: "Name", type: "text", maxLength: NAME_MAX_LENGTH },
  email: { label: "Email", type: "email", maxLength: EMAIL_MAX_LENGTH },
  password: {
    label: "Password",
    type: "password",
    maxLength: PASSWORD_MAX_LENGTH,
  },
};

/**
 * Sign-in / sign-up form posting to a Server Action.
 *
 * - Without JS it is a plain form post; the action re-validates everything.
 * - With JS, fields validate on blur (once edited) and on submit, errors
 *   clear as soon as the value is fixed, and the first invalid field gets
 *   focus. Server errors appear under the field they belong to, or above
 *   the form when they concern the whole attempt.
 */
export function AuthForm({
  mode,
  action,
  submitLabel,
  pendingLabel,
  callbackURL,
}: {
  mode: AuthMode;
  action: (state: AuthFormState, data: FormData) => Promise<AuthFormState>;
  submitLabel: string;
  pendingLabel: string;
  callbackURL: string;
}) {
  const [state, formAction, pending] = useActionState(action, {});
  const fields = fieldsFor(mode);
  const inputs = useRef<Partial<Record<AuthField, HTMLInputElement | null>>>(
    {},
  );

  // Client-side errors, and fields edited since the last server response
  // (whose server error is then stale and hidden).
  const [clientErrors, setClientErrors] = useState<FieldErrors>({});
  const [edited, setEdited] = useState<Set<AuthField>>(new Set());
  const [showPassword, setShowPassword] = useState(false);
  const [passwordLength, setPasswordLength] = useState(0);

  const errorFor = (field: AuthField) =>
    clientErrors[field] ??
    (edited.has(field) ? undefined : state.fieldErrors?.[field]);
  const formError = edited.size ? undefined : state.formError;

  // Move focus to the first field the server rejected.
  useEffect(() => {
    const first = fields.find((f) => state.fieldErrors?.[f]);
    if (first) inputs.current[first]?.focus();
    // `fields` is derived from `mode`, which never changes for a form.
    // eslint-disable-next-line react-hooks/exhaustive-deps
  }, [state]);

  function onChange(field: AuthField, value: string) {
    if (field === "password") setPasswordLength(value.length);
    setEdited((prev) => (prev.has(field) ? prev : new Set(prev).add(field)));
    // Once an error shows, re-check live so it clears as soon as it's fixed.
    if (clientErrors[field]) {
      setClientErrors((prev) => ({
        ...prev,
        [field]: validateField(mode, field, value),
      }));
    }
  }

  function onBlur(field: AuthField, input: HTMLInputElement) {
    // Don't flag fields the user just tabbed through without typing. Compare
    // with the initial value directly: state may lag if the value changed in
    // the same tick (e.g. autofill followed by an immediate blur).
    if (!edited.has(field) && input.value === input.defaultValue) return;
    setClientErrors((prev) => ({
      ...prev,
      [field]: validateField(mode, field, input.value),
    }));
  }

  function onSubmit(event: React.FormEvent<HTMLFormElement>) {
    const data = new FormData(event.currentTarget);
    const errors = validateAuthForm(
      mode,
      Object.fromEntries(fields.map((f) => [f, String(data.get(f) ?? "")])),
    );
    const first = fields.find((f) => errors[f]);
    if (first) {
      event.preventDefault();
      setClientErrors(errors);
      inputs.current[first]?.focus();
      return;
    }
    // Valid: hand over to the Server Action and show its response fresh.
    // React clears the password after the action, so reset its hint too.
    setClientErrors({});
    setEdited(new Set());
    setPasswordLength(0);
  }

  return (
    <form
      action={formAction}
      onSubmit={onSubmit}
      noValidate
      aria-busy={pending}
      className="flex flex-col gap-6"
    >
      <input type="hidden" name="callbackURL" value={callbackURL} />

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

      <fieldset disabled={pending} className="flex flex-col gap-6">
        {fields.map((field) => {
          const meta = FIELD_META[field];
          const error = errorFor(field);
          const isPassword = field === "password";
          const hint = isPassword && mode === "sign-up";
          const describedBy =
            [error && `${field}-error`, hint && `${field}-hint`]
              .filter(Boolean)
              .join(" ") || undefined;

          return (
            <div key={field} className="flex flex-col gap-2">
              <label htmlFor={field} className="text-label">
                {meta.label}
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
                  type={isPassword && showPassword ? "text" : meta.type}
                  autoComplete={
                    isPassword
                      ? mode === "sign-up"
                        ? "new-password"
                        : "current-password"
                      : field
                  }
                  maxLength={meta.maxLength}
                  required
                  defaultValue={isPassword ? undefined : state.values?.[field]}
                  aria-invalid={Boolean(error)}
                  aria-describedby={describedBy}
                  onChange={(e) => onChange(field, e.target.value)}
                  onBlur={(e) => onBlur(field, e.currentTarget)}
                  className="text-body h-12 min-w-0 flex-1 bg-transparent outline-none disabled:opacity-60"
                />
                {isPassword && (
                  <button
                    type="button"
                    onClick={() => setShowPassword((v) => !v)}
                    aria-pressed={showPassword}
                    aria-controls={field}
                    aria-label={
                      showPassword ? "Hide password" : "Show password"
                    }
                    className="text-label text-muted hover:text-foreground shrink-0 py-2 transition-colors"
                  >
                    {showPassword ? "Hide" : "Show"}
                  </button>
                )}
              </div>

              {hint && (
                <p
                  id={`${field}-hint`}
                  className={cn(
                    "text-meta flex items-center gap-2 transition-colors",
                    passwordLength >= PASSWORD_MIN_LENGTH
                      ? "text-foreground"
                      : "text-muted",
                  )}
                >
                  <Check
                    className={cn(
                      "size-3.5 transition-opacity",
                      passwordLength >= PASSWORD_MIN_LENGTH
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

      <Button type="submit" fullWidth disabled={pending} className="mt-2">
        {pending && (
          <LoaderCircle
            className="size-4 animate-spin"
            strokeWidth={1.5}
            aria-hidden
          />
        )}
        {pending ? pendingLabel : submitLabel}
      </Button>
    </form>
  );
}
