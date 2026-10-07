"use server";

import { redirect } from "next/navigation";

import { type AdminFormState, SAVE_FAILED } from "@/app/admin/form-state";
import * as catalog from "@/db/catalog-admin";
import {
  type ProductField,
  parseProductForm,
  parseWholeNumber,
} from "@/lib/admin-validation";
import { requireAdmin } from "@/lib/session";
import { revalidateStorefront } from "@/lib/storefront-cache";

export type ProductFormState = AdminFormState<ProductField>;

/** Turns a failed write into form errors; rethrows anything unexpected. */
function writeError(
  error: unknown,
  values: ProductFormState["values"],
): ProductFormState {
  if (error instanceof catalog.UniqueViolationError)
    return {
      fieldErrors: {
        [error.field]:
          error.field === "slug"
            ? "Another product already uses this slug."
            : "Another product already uses this SKU.",
      },
      values,
    };
  if (error instanceof catalog.UnknownCategoryError)
    return {
      fieldErrors: { categoryId: "That category no longer exists." },
      values,
    };
  console.error("[admin] product save failed", error);
  return { formError: SAVE_FAILED, values };
}

export async function createProduct(
  _prev: ProductFormState,
  data: FormData,
): Promise<ProductFormState> {
  const { user } = await requireAdmin("/admin/products/new");

  const { values, errors, input, stock } = parseProductForm(data, "create");
  if (!input) return { fieldErrors: errors, values };

  let id: number;
  try {
    id = await catalog.createProduct(input, stock ?? 0, user.id);
  } catch (error) {
    return writeError(error, values);
  }

  revalidateStorefront();
  redirect(`/admin/products/${id}`);
}

export async function updateProduct(
  productId: number,
  _prev: ProductFormState,
  data: FormData,
): Promise<ProductFormState> {
  await requireAdmin(`/admin/products/${productId}`);

  // Bound by the page, but still client-supplied: re-check it.
  const id = parseWholeNumber(String(productId), 1, 2 ** 31 - 1);
  const { values, errors, input } = parseProductForm(data, "edit");
  if (id === undefined) return { formError: SAVE_FAILED, values };
  if (!input) return { fieldErrors: errors, values };

  try {
    await catalog.updateProduct(id, input);
  } catch (error) {
    if (error instanceof catalog.NotFoundError)
      return { formError: "This product no longer exists.", values };
    return writeError(error, values);
  }

  revalidateStorefront();
  return { saved: true, values };
}
