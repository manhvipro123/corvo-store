"use client";

import { useActionState } from "react";

import type { DeleteCategoryState } from "@/app/admin/categories/actions";
import { SubmitButton } from "@/components/checkout/submit-button";
import { FormError } from "@/components/ui/field";

/** Deletes an empty category after a confirmation prompt. */
export function DeleteCategoryForm({
  action,
  name,
}: {
  action: () => Promise<DeleteCategoryState>;
  name: string;
}) {
  const [state, formAction] = useActionState(action, {});
  return (
    <form
      action={formAction}
      onSubmit={(event) => {
        if (
          !window.confirm(
            `Delete the category “${name}”? This can't be undone.`,
          )
        )
          event.preventDefault();
      }}
      className="flex flex-col items-start gap-4"
    >
      <FormError message={state.formError} />
      <div className="w-full sm:w-auto">
        <SubmitButton variant="secondary" pendingLabel="Deleting…">
          Delete category
        </SubmitButton>
      </div>
    </form>
  );
}
