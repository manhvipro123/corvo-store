/**
 * Admin form rules, shared by the browser (checked on submit) and the Server
 * Actions (authoritative), like `auth-validation.ts`. Each parser returns the
 * raw `values` (echoed back so a form keeps what was typed), per-field
 * `errors`, and the typed `input` only when there are no errors.
 */

import { STRIPE_MAX_TOTAL_CENTS } from "@/lib/checkout";
import { colors } from "@/lib/colors";
import type { ColorSlug } from "@/types/catalog";

type Source = Pick<FormData, "get">;

type Parsed<F extends string, T> = {
  values: Record<F, string>;
  errors: Partial<Record<F, string>>;
  input?: T;
};

export const TEXT_MAX_LENGTH = 200;
export const LONG_TEXT_MAX_LENGTH = 4000;
export const STOCK_MAX = 100_000;
/** $999,999.99: Stripe's largest USD charge, well inside a Postgres integer. */
const PRICE_MAX_CENTS = STRIPE_MAX_TOTAL_CENTS;
const POSITION_MAX = 1_000_000;
/** Must match `images.remotePatterns` in next.config.ts. */
export const IMAGE_HOST = "images.unsplash.com";

const SLUG_PATTERN = /^[a-z0-9]+(?:-[a-z0-9]+)*$/;
const SKU_PATTERN = /^[A-Z0-9][A-Z0-9-]*$/;

function read<F extends string>(data: Source, fields: readonly F[]) {
  const values = {} as Record<F, string>;
  for (const field of fields) {
    const value = data.get(field);
    values[field] = typeof value === "string" ? value.trim() : "";
  }
  return values;
}

function requiredText(value: string, label: string, max = TEXT_MAX_LENGTH) {
  if (!value) return `Enter ${label}.`;
  if (value.length > max) return `Use ${max} characters or fewer.`;
}

function slugError(value: string) {
  if (!value) return "Enter a slug.";
  if (value.length > TEXT_MAX_LENGTH)
    return `Use ${TEXT_MAX_LENGTH} characters or fewer.`;
  if (!SLUG_PATTERN.test(value))
    return "Use lowercase letters, numbers and single hyphens, like silk-scarf-ivory.";
}

/** Whole number in [min, max] from a form string, or undefined. */
export function parseWholeNumber(value: string, min: number, max: number) {
  if (!/^\d+$/.test(value)) return undefined;
  const n = Number(value);
  return n >= min && n <= max ? n : undefined;
}

/**
 * "1250", "1,250.5" or "$1,250.50" → 125050 cents. Parsed as text so no
 * float ever touches a price.
 */
export function parsePriceCents(raw: string): number | undefined {
  const value = raw.replace(/^\$/, "").replace(/,(?=\d{3}(\D|$))/g, "");
  const match = /^(\d+)(?:\.(\d{1,2}))?$/.exec(value);
  if (!match) return undefined;
  const cents =
    Number(match[1]) * 100 + Number((match[2] ?? "").padEnd(2, "0"));
  return cents <= PRICE_MAX_CENTS ? cents : undefined;
}

/** Cents → the plain "1250.00" a price input shows. */
export const priceInputValue = (cents: number) => (cents / 100).toFixed(2);

export function isAllowedImageUrl(value: string) {
  try {
    const url = new URL(value);
    return url.protocol === "https:" && url.hostname === IMAGE_HOST;
  } catch {
    return false;
  }
}

/** Suggested slug for a name: "Silk Scarf, Ivory" → "silk-scarf-ivory". */
export function slugify(name: string) {
  return name
    .normalize("NFKD")
    .replace(/[̀-ͯ]/g, "")
    .toLowerCase()
    .replace(/[^a-z0-9]+/g, "-")
    .replace(/^-+|-+$/g, "")
    .slice(0, TEXT_MAX_LENGTH);
}

/** Optional position: blank means "keep / put at the end". */
function positionField(value: string) {
  if (!value) return { position: undefined };
  const position = parseWholeNumber(value, 0, POSITION_MAX);
  return position === undefined
    ? { error: `Enter a whole number from 0 to ${POSITION_MAX}.` }
    : { position };
}

export const productFields = [
  "name",
  "slug",
  "sku",
  "categoryId",
  "color",
  "price",
  "description",
  "details",
  "imageUrl",
  "imageAlt",
  "imageFit",
  "isNew",
  "position",
  "stock",
] as const;
export type ProductField = (typeof productFields)[number];

export type ProductInput = {
  name: string;
  slug: string;
  sku: string;
  categoryId: number;
  color: ColorSlug;
  priceCents: number;
  description: string;
  details: string[];
  imageUrl: string;
  imageAlt: string;
  imageFit: "contain" | "cover";
  isNew: boolean;
  /** Undefined: at the end on create, unchanged on edit. */
  position?: number;
};

/** `mode: "create"` also requires the starting `stock` (0 when editing). */
export function parseProductForm(
  data: Source,
  mode: "create" | "edit",
): Parsed<ProductField, ProductInput> & { stock?: number } {
  const values = read(data, productFields);
  values.sku = values.sku.toUpperCase();
  const errors: Partial<Record<ProductField, string>> = {};

  const set = (field: ProductField, error: string | undefined) => {
    if (error) errors[field] = error;
  };

  set("name", requiredText(values.name, "a name"));
  set("slug", slugError(values.slug));
  set(
    "sku",
    requiredText(values.sku, "a SKU", 40) ??
      (SKU_PATTERN.test(values.sku)
        ? undefined
        : "Use letters, numbers and hyphens, like CV-BG-1001."),
  );
  const categoryId = parseWholeNumber(values.categoryId, 1, 2 ** 31 - 1);
  if (categoryId === undefined) set("categoryId", "Choose a category.");
  const color = colors.find((c) => c.slug === values.color)?.slug;
  if (!color) set("color", "Choose a colour.");
  const priceCents = parsePriceCents(values.price);
  if (priceCents === undefined)
    set(
      "price",
      "Enter a price in dollars up to 999999.99, like 1250 or 1250.50.",
    );
  set(
    "description",
    requiredText(values.description, "a description", LONG_TEXT_MAX_LENGTH),
  );
  const details = values.details
    .split(/\r?\n/)
    .map((line) => line.trim())
    .filter(Boolean);
  if (details.some((line) => line.length > TEXT_MAX_LENGTH))
    set("details", `Keep each line to ${TEXT_MAX_LENGTH} characters.`);
  else if (details.length > 20) set("details", "Use 20 lines or fewer.");
  set(
    "imageUrl",
    values.imageUrl
      ? isAllowedImageUrl(values.imageUrl)
        ? undefined
        : `Use an https://${IMAGE_HOST}/ image URL.`
      : "Enter an image URL.",
  );
  set("imageAlt", requiredText(values.imageAlt, "a short image description"));
  const imageFit =
    values.imageFit === "cover" || values.imageFit === "contain"
      ? values.imageFit
      : undefined;
  if (!imageFit) set("imageFit", "Choose how the photo fills its tile.");
  const { position, error: positionError } = positionField(values.position);
  set("position", positionError);
  const stock =
    mode === "create" ? parseWholeNumber(values.stock, 0, STOCK_MAX) : 0;
  if (stock === undefined)
    set("stock", `Enter a whole number from 0 to ${STOCK_MAX}.`);

  if (Object.keys(errors).length) return { values, errors };
  return {
    values,
    errors,
    input: {
      name: values.name,
      slug: values.slug,
      sku: values.sku,
      categoryId: categoryId!,
      color: color!,
      priceCents: priceCents!,
      description: values.description,
      details,
      imageUrl: values.imageUrl,
      imageAlt: values.imageAlt,
      imageFit: imageFit!,
      isNew: values.isNew === "on",
      position,
    },
    stock,
  };
}

export const categoryFields = [
  "name",
  "slug",
  "description",
  "position",
] as const;
export type CategoryField = (typeof categoryFields)[number];

export type CategoryInput = {
  name: string;
  slug: string;
  description: string;
  /** Undefined: last on create, unchanged on edit. */
  position?: number;
};

export function parseCategoryForm(
  data: Source,
): Parsed<CategoryField, CategoryInput> {
  const values = read(data, categoryFields);
  const errors: Partial<Record<CategoryField, string>> = {};
  const name = requiredText(values.name, "a name", 60);
  if (name) errors.name = name;
  const slug = slugError(values.slug);
  if (slug) errors.slug = slug;
  const description = requiredText(
    values.description,
    "a description",
    LONG_TEXT_MAX_LENGTH,
  );
  if (description) errors.description = description;
  const { position, error } = positionField(values.position);
  if (error) errors.position = error;

  if (Object.keys(errors).length) return { values, errors };
  return {
    values,
    errors,
    input: {
      name: values.name,
      slug: values.slug,
      description: values.description,
      position,
    },
  };
}

export type StockInput = {
  productId: number;
  /** The quantity the admin saw; the write fails if it changed since. */
  expected: number;
  quantity: number;
};

/**
 * A stock update: either a quantity, or the "Mark sold out" submit button
 * (`intent=sold-out`), which sets 0 whatever the quantity field holds.
 */
export function parseStockForm(
  data: Source,
): Parsed<"quantity", StockInput> & { invalid?: true } {
  const raw = read(data, [
    "productId",
    "expected",
    "quantity",
    "intent",
  ] as const);
  const productId = parseWholeNumber(raw.productId, 1, 2 ** 31 - 1);
  const expected = parseWholeNumber(raw.expected, 0, 2 ** 31 - 1);
  // Hidden fields and the intent only change if the request was tampered with.
  if (
    productId === undefined ||
    expected === undefined ||
    (raw.intent !== "" && raw.intent !== "sold-out")
  )
    return { values: { quantity: raw.quantity }, errors: {}, invalid: true };
  const soldOut = raw.intent === "sold-out";
  const values = { quantity: soldOut ? "0" : raw.quantity };
  const quantity = parseWholeNumber(values.quantity, 0, STOCK_MAX);
  if (quantity === undefined)
    return {
      values,
      errors: { quantity: `Enter a whole number from 0 to ${STOCK_MAX}.` },
    };
  return { values, errors: {}, input: { productId, expected, quantity } };
}

export const STOCK_NOTE_MAX_LENGTH = 200;

export type StockAdjustInput = {
  productId: number;
  /** Units to add; negative to write some off. Never 0. */
  delta: number;
  note?: string;
};

export type StockAdjustField = "amount" | "note";

/**
 * An "add or remove N units" form: `direction` is `in` (received) or `out`
 * (written off), `amount` a whole number of units, `note` optional.
 */
export function parseStockAdjustForm(
  data: Source,
): Parsed<StockAdjustField, StockAdjustInput> & { invalid?: true } {
  const raw = read(data, ["productId", "direction", "amount", "note"] as const);
  const values = { amount: raw.amount, note: raw.note };
  const productId = parseWholeNumber(raw.productId, 1, 2 ** 31 - 1);
  // Hidden or fixed-choice fields only change if the request was tampered with.
  if (
    productId === undefined ||
    (raw.direction !== "in" && raw.direction !== "out")
  )
    return { values, errors: {}, invalid: true };

  const errors: Partial<Record<StockAdjustField, string>> = {};
  const amount = parseWholeNumber(raw.amount, 1, STOCK_MAX);
  if (amount === undefined)
    errors.amount = `Enter a whole number from 1 to ${STOCK_MAX}.`;
  if (raw.note.length > STOCK_NOTE_MAX_LENGTH)
    errors.note = `Use ${STOCK_NOTE_MAX_LENGTH} characters or fewer.`;
  if (Object.keys(errors).length) return { values, errors };

  return {
    values,
    errors,
    input: {
      productId,
      delta: raw.direction === "in" ? amount! : -amount!,
      note: raw.note || undefined,
    },
  };
}
