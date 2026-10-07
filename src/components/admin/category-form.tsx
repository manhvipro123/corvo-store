"use client";

import { LoaderCircle } from "lucide-react";
import { useActionState, useEffect, useRef, useState } from "react";

import type { CategoryFormState } from "@/app/admin/categories/actions";
import { Button } from "@/components/ui/button";
import {
  Field,
  FormError,
  FormStatus,
  fieldProps,
  inputClass,
} from "@/components/ui/field";
import {
  type CategoryField,
  parseCategoryForm,
  slugify,
} from "@/lib/admin-validation";
import type { AdminCategory } from "@/types/admin";

type Action = (
  state: CategoryFormState,
  data: FormData,
) => Promise<CategoryFormState>;

/** Create / edit form for a category; same behaviour as `ProductForm`. */
export function CategoryForm({
  action,
  category,
}: {
  action: Action;
  category?: AdminCategory;
}) {
  const [state, formAction, pending] = useActionState(action, {});
  const form = useRef<HTMLFormElement>(null);
  const [clientErrors, setClientErrors] =
    useState<Partial<Record<CategoryField, string>>>();
  const [slugTouched, setSlugTouched] = useState(Boolean(category));
  const values: Partial<Record<CategoryField, string>> = {
    ...(category && {
      name: category.name,
      slug: category.slug,
      description: category.description,
      position: String(category.position),
    }),
    ...state.values,
  };
  const errors = clientErrors ?? state.fieldErrors ?? {};

  useEffect(() => {
    if (state.fieldErrors)
      form.current?.querySelector<HTMLElement>("[aria-invalid=true]")?.focus();
  }, [state]);

  function onSubmit(event: React.FormEvent<HTMLFormElement>) {
    const { errors } = parseCategoryForm(new FormData(event.currentTarget));
    if (Object.keys(errors).length) {
      event.preventDefault();
      setClientErrors(errors);
      requestAnimationFrame(() =>
        form.current
          ?.querySelector<HTMLElement>("[aria-invalid=true]")
          ?.focus(),
      );
      return;
    }
    setClientErrors(undefined);
    // On success the create form clears; the next name drives the slug again.
    if (!category) setSlugTouched(false);
  }

  return (
    <form
      ref={form}
      action={formAction}
      onSubmit={onSubmit}
      noValidate
      aria-busy={pending}
      className="flex flex-col gap-8"
    >
      <FormError message={state.formError} />
      <fieldset disabled={pending} className="grid gap-8 md:grid-cols-2">
        <Field id="name" label="Name" error={errors.name}>
          <input
            {...fieldProps("name", errors.name)}
            type="text"
            defaultValue={values.name}
            onChange={(e) => {
              if (slugTouched || !form.current) return;
              form.current.slug.value = slugify(e.target.value);
            }}
            className={inputClass(errors.name, "h-12")}
          />
        </Field>
        <Field
          id="slug"
          label="Slug"
          hint={
            category
              ? "Used in shop filter URLs. Changing it breaks links to the old one."
              : "Used in shop filter URLs, e.g. small-leather-goods."
          }
          error={errors.slug}
        >
          <input
            {...fieldProps("slug", errors.slug, true)}
            type="text"
            defaultValue={values.slug}
            onChange={() => setSlugTouched(true)}
            autoCapitalize="none"
            spellCheck={false}
            className={inputClass(errors.slug, "h-12")}
          />
        </Field>
        <Field
          id="description"
          label="Description"
          error={errors.description}
          className="md:col-span-2"
        >
          <textarea
            {...fieldProps("description", errors.description)}
            rows={3}
            defaultValue={values.description}
            className={inputClass(errors.description, "resize-y py-3")}
          />
        </Field>
        <Field
          id="position"
          label="Position"
          hint={
            category
              ? "Tab order in the shop, lowest first."
              : "Tab order in the shop, lowest first. Leave blank to add it at the end."
          }
          error={errors.position}
        >
          <input
            {...fieldProps("position", errors.position, true)}
            type="text"
            inputMode="numeric"
            defaultValue={values.position}
            className={inputClass(errors.position, "h-12 tabular-nums")}
          />
        </Field>
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
          {pending ? "Saving…" : category ? "Save changes" : "Create category"}
        </Button>
        <FormStatus
          show={state.saved}
          message={category ? "Category saved." : "Category created."}
        />
      </div>
    </form>
  );
}
