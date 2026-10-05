"use client";

import { Check, CircleAlert, LoaderCircle } from "lucide-react";
import { useActionState, useEffect, useRef, useState } from "react";

import { updateProfile } from "@/app/account/actions";
import { Button } from "@/components/ui/button";
import { NAME_MAX_LENGTH, validateField } from "@/lib/auth-validation";
import { cn } from "@/lib/utils";

/**
 * Edits the customer's name; email is shown read-only (changing it would need
 * a verification flow). Same field styling and validation behaviour as the
 * auth forms: validate on blur once edited, re-check live once an error shows.
 */
export function ProfileForm({ name, email }: { name: string; email: string }) {
  const [state, formAction, pending] = useActionState(updateProfile, {});
  const input = useRef<HTMLInputElement>(null);
  const [clientError, setClientError] = useState<string>();
  // Edited since the last server response: hides its (now stale) messages.
  const [edited, setEdited] = useState(false);

  const error = clientError ?? (edited ? undefined : state.fieldErrors?.name);
  const formError = edited ? undefined : state.formError;
  const saved = !edited && state.saved;

  useEffect(() => {
    if (state.fieldErrors?.name) input.current?.focus();
  }, [state]);

  function onSubmit(event: React.FormEvent<HTMLFormElement>) {
    const value = input.current?.value ?? "";
    const problem = validateField("sign-up", "name", value);
    if (problem) {
      event.preventDefault();
      setClientError(problem);
      input.current?.focus();
      return;
    }
    setClientError(undefined);
    setEdited(false);
  }

  return (
    <form
      action={formAction}
      onSubmit={onSubmit}
      noValidate
      aria-busy={pending}
      className="flex flex-col gap-8"
    >
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

      <div className="flex flex-col gap-2">
        <label htmlFor="name" className="text-label">
          Name
        </label>
        <input
          ref={input}
          id="name"
          name="name"
          type="text"
          autoComplete="name"
          maxLength={NAME_MAX_LENGTH}
          required
          disabled={pending}
          defaultValue={state.values?.name ?? name}
          aria-invalid={Boolean(error)}
          aria-describedby={error ? "name-error" : undefined}
          onChange={(e) => {
            setEdited(true);
            if (clientError)
              setClientError(validateField("sign-up", "name", e.target.value));
          }}
          onBlur={(e) => {
            const el = e.currentTarget;
            if (el.value === el.defaultValue && !edited) return;
            setClientError(validateField("sign-up", "name", el.value));
          }}
          className={cn(
            "text-body h-12 border-b bg-transparent transition-colors outline-none disabled:opacity-60",
            error
              ? "border-foreground"
              : "border-border focus:border-foreground",
          )}
        />
        {error && (
          <p id="name-error" className="text-meta flex items-start gap-2">
            <CircleAlert
              className="mt-px size-3.5 shrink-0"
              strokeWidth={1.5}
              aria-hidden
            />
            {error}
          </p>
        )}
      </div>

      <div className="flex flex-col gap-2">
        <label htmlFor="email" className="text-label">
          Email
        </label>
        <input
          id="email"
          type="email"
          value={email}
          readOnly
          aria-describedby="email-hint"
          className="text-body text-muted border-border h-12 border-b bg-transparent outline-none"
        />
        <p id="email-hint" className="text-meta text-muted">
          Your email is used to sign in and can’t be changed here.
        </p>
      </div>

      <div className="flex flex-col items-start gap-4 sm:flex-row sm:items-center">
        <Button type="submit" disabled={pending} className="w-full sm:w-auto">
          {pending && (
            <LoaderCircle
              className="size-4 animate-spin"
              strokeWidth={1.5}
              aria-hidden
            />
          )}
          {pending ? "Saving…" : "Save changes"}
        </Button>
        <p role="status" className="text-meta flex items-center gap-2">
          {saved && (
            <>
              <Check className="size-3.5" strokeWidth={2} aria-hidden />
              Your details have been saved.
            </>
          )}
        </p>
      </div>
    </form>
  );
}
