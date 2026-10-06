import Form from "next/form";
import { Search } from "lucide-react";

/**
 * GET form to /search?q=… — a plain HTML form without JS, client-side
 * navigation with it. Hairline underline field, square corners.
 */
export function SearchForm({
  defaultValue,
  autoFocus,
}: {
  defaultValue?: string;
  autoFocus?: boolean;
}) {
  return (
    <Form
      action="/search"
      role="search"
      // The underline darkens on focus; it is the field's focus indicator.
      className="border-border focus-within:border-foreground flex max-w-2xl items-center gap-3 border-b transition-colors"
    >
      <label htmlFor="search-query" className="sr-only">
        Search products
      </label>
      <Search
        className="text-muted size-5 shrink-0"
        strokeWidth={1.5}
        aria-hidden
      />
      <input
        id="search-query"
        name="q"
        type="search"
        defaultValue={defaultValue}
        autoFocus={autoFocus}
        placeholder="Search bags, coats, rings…"
        maxLength={100}
        autoComplete="off"
        enterKeyHint="search"
        className="text-body placeholder:text-muted h-12 min-w-0 flex-1 bg-transparent outline-none"
      />
      <button
        type="submit"
        className="text-label shrink-0 py-2 underline-offset-4 hover:underline"
      >
        Search
      </button>
    </Form>
  );
}
