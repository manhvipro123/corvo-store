"use client";

import { LoaderCircle } from "lucide-react";
import { useActionState, useEffect, useRef, useState } from "react";

import type { ProductFormState } from "@/app/admin/products/actions";
import { ProductImage } from "@/components/product/product-image";
import { Button } from "@/components/ui/button";
import {
  Field,
  FormError,
  FormStatus,
  fieldProps,
  inputClass,
} from "@/components/ui/field";
import { MediaFrame } from "@/components/ui/media-frame";
import {
  IMAGE_HOST,
  type ProductField,
  STOCK_MAX,
  isAllowedImageUrl,
  parseProductForm,
  priceInputValue,
  slugify,
} from "@/lib/admin-validation";
import { colors } from "@/lib/colors";
import type { AdminProduct } from "@/types/admin";

type Action = (
  state: ProductFormState,
  data: FormData,
) => Promise<ProductFormState>;

/** Form values for an existing product, as the inputs show them. */
function initialValues(
  product: AdminProduct | undefined,
): Partial<Record<ProductField, string>> {
  if (!product) return { imageFit: "contain" };
  return {
    name: product.name,
    slug: product.slug,
    sku: product.sku,
    categoryId: String(product.categoryId),
    color: product.color,
    price: priceInputValue(product.priceCents),
    description: product.description,
    details: product.details.join("\n"),
    imageUrl: product.image.src,
    imageAlt: product.image.alt,
    imageFit: product.image.fit ?? "contain",
    isNew: product.isNew ? "on" : "",
    position: String(product.position),
  };
}

/**
 * Create / edit form for a product. Checked in the browser on submit with
 * the same rules as the Server Action, which has the final say. Stock is
 * only set here when creating; afterwards it's managed on /admin/inventory.
 */
export function ProductForm({
  action,
  categories,
  product,
}: {
  action: Action;
  categories: { id: number; name: string }[];
  product?: AdminProduct;
}) {
  const mode = product ? "edit" : "create";
  const [state, formAction, pending] = useActionState(action, {});
  const form = useRef<HTMLFormElement>(null);
  const [clientErrors, setClientErrors] =
    useState<Partial<Record<ProductField, string>>>();
  const values = { ...initialValues(product), ...state.values };
  const errors = clientErrors ?? state.fieldErrors ?? {};

  // New products get a slug from the name until the slug is edited by hand.
  const [slugTouched, setSlugTouched] = useState(Boolean(product));
  const [imageUrl, setImageUrl] = useState(values.imageUrl ?? "");
  const [imageFit, setImageFit] = useState<"contain" | "cover">(
    values.imageFit === "cover" ? "cover" : "contain",
  );

  useEffect(() => {
    if (!state.fieldErrors) return;
    form.current?.querySelector<HTMLElement>("[aria-invalid=true]")?.focus();
  }, [state]);

  function onSubmit(event: React.FormEvent<HTMLFormElement>) {
    const { errors } = parseProductForm(
      new FormData(event.currentTarget),
      mode,
    );
    if (Object.keys(errors).length) {
      event.preventDefault();
      setClientErrors(errors);
      // After React renders the error state.
      requestAnimationFrame(() =>
        form.current
          ?.querySelector<HTMLElement>("[aria-invalid=true]")
          ?.focus(),
      );
      return;
    }
    setClientErrors(undefined);
  }

  const text = (id: ProductField, label: string, hint?: string) => (
    <Field id={id} label={label} hint={hint} error={errors[id]}>
      <input
        {...fieldProps(id, errors[id], Boolean(hint))}
        type="text"
        defaultValue={values[id]}
        className={inputClass(errors[id], "h-12")}
      />
    </Field>
  );

  return (
    <form
      ref={form}
      action={formAction}
      onSubmit={onSubmit}
      noValidate
      aria-busy={pending}
      className="flex flex-col gap-10"
    >
      <FormError message={state.formError} />

      <fieldset disabled={pending} className="grid gap-8 md:grid-cols-2">
        <legend className="text-heading mb-6">Details</legend>
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
            product
              ? "Part of the product's URL. Changing it breaks links to the old URL."
              : "Part of the product's URL, e.g. silk-scarf-ivory."
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
        {text("sku", "SKU")}
        <Field id="categoryId" label="Category" error={errors.categoryId}>
          <select
            key={values.categoryId}
            {...fieldProps("categoryId", errors.categoryId)}
            defaultValue={values.categoryId ?? ""}
            className={inputClass(errors.categoryId, "bg-background h-12")}
          >
            <option value="" disabled>
              Choose a category
            </option>
            {categories.map((c) => (
              <option key={c.id} value={c.id}>
                {c.name}
              </option>
            ))}
          </select>
        </Field>
        <Field id="color" label="Colour" error={errors.color}>
          <select
            key={values.color}
            {...fieldProps("color", errors.color)}
            defaultValue={values.color ?? ""}
            className={inputClass(errors.color, "bg-background h-12")}
          >
            <option value="" disabled>
              Choose a colour
            </option>
            {colors.map((c) => (
              <option key={c.slug} value={c.slug}>
                {c.label}
              </option>
            ))}
          </select>
        </Field>
        <Field
          id="price"
          label="Price (USD)"
          hint="In dollars, e.g. 1250 or 1250.50."
          error={errors.price}
        >
          <input
            {...fieldProps("price", errors.price, true)}
            type="text"
            inputMode="decimal"
            defaultValue={values.price}
            className={inputClass(errors.price, "h-12 tabular-nums")}
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
            rows={4}
            defaultValue={values.description}
            className={inputClass(errors.description, "resize-y py-3")}
          />
        </Field>
        <Field
          id="details"
          label="Details"
          hint="One material or construction fact per line."
          error={errors.details}
          className="md:col-span-2"
        >
          <textarea
            {...fieldProps("details", errors.details, true)}
            rows={4}
            defaultValue={values.details}
            className={inputClass(errors.details, "resize-y py-3")}
          />
        </Field>
      </fieldset>

      <fieldset
        disabled={pending}
        className="grid gap-8 md:grid-cols-[minmax(0,1fr)_10rem]"
      >
        <legend className="text-heading mb-6">Image</legend>
        <div className="flex flex-col gap-8">
          <Field
            id="imageUrl"
            label="Image URL"
            hint={`Only https://${IMAGE_HOST}/ photos can be shown.`}
            error={errors.imageUrl}
          >
            <input
              {...fieldProps("imageUrl", errors.imageUrl, true)}
              type="url"
              defaultValue={values.imageUrl}
              onChange={(e) => setImageUrl(e.target.value.trim())}
              spellCheck={false}
              className={inputClass(errors.imageUrl, "h-12")}
            />
          </Field>
          {text(
            "imageAlt",
            "Image description",
            "Read aloud by screen readers.",
          )}
          <Field
            id="imageFit"
            label="Fit"
            hint="Contain for cut-outs and landscape shots; cover only for portrait photos with their own backdrop."
            error={errors.imageFit}
          >
            <select
              key={values.imageFit}
              {...fieldProps("imageFit", errors.imageFit, true)}
              defaultValue={values.imageFit}
              onChange={(e) =>
                setImageFit(e.target.value as "contain" | "cover")
              }
              className={inputClass(errors.imageFit, "bg-background h-12")}
            >
              <option value="contain">Contain</option>
              <option value="cover">Cover</option>
            </select>
          </Field>
        </div>
        <div aria-hidden className="w-40">
          <p className="text-label mb-2">Preview</p>
          <MediaFrame>
            {isAllowedImageUrl(imageUrl) ? (
              <ProductImage
                image={{ src: imageUrl, alt: "", fit: imageFit }}
                sizes="160px"
              />
            ) : (
              <p className="text-meta text-muted absolute inset-0 grid place-items-center p-4 text-center">
                No image
              </p>
            )}
          </MediaFrame>
        </div>
      </fieldset>

      <fieldset disabled={pending} className="grid gap-8 md:grid-cols-2">
        <legend className="text-heading mb-6">Merchandising</legend>
        <Field
          id="position"
          label="Position"
          hint={
            product
              ? "Recommended order, lowest first."
              : "Recommended order, lowest first. Leave blank to add it at the end."
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
        {!product && (
          <Field
            id="stock"
            label="Starting stock"
            hint={`Units available to sell, 0 to ${STOCK_MAX}. Later changes happen in Inventory.`}
            error={errors.stock}
          >
            <input
              {...fieldProps("stock", errors.stock, true)}
              type="text"
              inputMode="numeric"
              defaultValue={values.stock ?? "0"}
              className={inputClass(errors.stock, "h-12 tabular-nums")}
            />
          </Field>
        )}
        <label className="text-body flex items-center gap-3 md:col-span-2">
          <input
            key={values.isNew}
            name="isNew"
            type="checkbox"
            defaultChecked={values.isNew === "on"}
            className="accent-foreground size-4"
          />
          Show in New arrivals
        </label>
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
          {pending ? "Saving…" : product ? "Save changes" : "Create product"}
        </Button>
        <FormStatus show={state.saved} message="Product saved." />
      </div>
    </form>
  );
}
