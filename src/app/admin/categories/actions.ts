"use server";

import { redirect } from "next/navigation";

import { type AdminFormState, SAVE_FAILED } from "@/app/admin/form-state";
import * as catalog from "@/db/catalog-admin";
import {
  type CategoryField,
  parseCategoryForm,
  parseWholeNumber,
} from "@/lib/admin-validation";
import { requireAdmin } from "@/lib/session";
import { revalidateStorefront } from "@/lib/storefront-cache";

export type CategoryFormState = AdminFormState<CategoryField>;

function writeError(
  error: unknown,
  values: CategoryFormState["values"],
): CategoryFormState {
  if (error instanceof catalog.UniqueViolationError)
    return {
      fieldErrors: { slug: "Another category already uses this slug." },
      values,
    };
  if (error instanceof catalog.NotFoundError)
    return { formError: "This category no longer exists.", values };
  console.error("[admin] category save failed", error);
  return { formError: SAVE_FAILED, values };
}

const readId = (id: number) => parseWholeNumber(String(id), 1, 2 ** 31 - 1);

export async function createCategory(
  _prev: CategoryFormState,
  data: FormData,
): Promise<CategoryFormState> {
  await requireAdmin("/admin/categories");

  const { values, errors, input } = parseCategoryForm(data);
  if (!input) return { fieldErrors: errors, values };

  try {
    await catalog.createCategory(input);
  } catch (error) {
    return writeError(error, values);
  }

  revalidateStorefront();
  // No values echoed: the form clears for the next one.
  return { saved: true };
}

export async function updateCategory(
  categoryId: number,
  _prev: CategoryFormState,
  data: FormData,
): Promise<CategoryFormState> {
  await requireAdmin(`/admin/categories/${categoryId}`);

  const id = readId(categoryId);
  const { values, errors, input } = parseCategoryForm(data);
  if (id === undefined) return { formError: SAVE_FAILED, values };
  if (!input) return { fieldErrors: errors, values };

  try {
    await catalog.updateCategory(id, input);
  } catch (error) {
    return writeError(error, values);
  }

  revalidateStorefront();
  return { saved: true, values };
}

export type DeleteCategoryState = { formError?: string };

/** Bound to the category id; ignores the form's state and data. */
export async function deleteCategory(
  categoryId: number,
): Promise<DeleteCategoryState> {
  await requireAdmin(`/admin/categories/${categoryId}`);

  const id = readId(categoryId);
  if (id === undefined) return { formError: SAVE_FAILED };

  try {
    await catalog.deleteCategory(id);
  } catch (error) {
    if (error instanceof catalog.CategoryInUseError)
      return {
        formError:
          "This category still has products. Move them to another category first.",
      };
    if (!(error instanceof catalog.NotFoundError)) {
      console.error("[admin] category delete failed", error);
      return {
        formError: "We couldn't delete this category. Please try again.",
      };
    }
    // Already gone: same outcome as deleting it.
  }

  revalidateStorefront();
  redirect("/admin/categories");
}
