/** Longest query we act on; anything beyond is ignored. */
const MAX_QUERY_LENGTH = 100;
/** Extra words beyond this add little and cost a clause each. */
const MAX_TERMS = 5;

/** Trims, collapses whitespace and caps length; "" when there's nothing to search. */
export function normalizeQuery(raw: string | string[] | undefined) {
  const value = Array.isArray(raw) ? raw[0] : raw;
  return (value ?? "").replace(/\s+/g, " ").trim().slice(0, MAX_QUERY_LENGTH);
}

/** Distinct lower-cased words; every one must match for a product to be found. */
export function searchTerms(query: string) {
  return [...new Set(query.toLowerCase().split(" ").filter(Boolean))].slice(
    0,
    MAX_TERMS,
  );
}

/** Escapes LIKE wildcards so user input is matched literally. */
export function escapeLike(term: string) {
  return term.replace(/[\\%_]/g, (char) => `\\${char}`);
}
