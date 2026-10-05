/**
 * Unsplash source URL capped at a sensible width so the Next.js image
 * optimizer doesn't download multi-megapixel originals.
 */
export function unsplash(id: string, width = 2000) {
  return `https://images.unsplash.com/${id}?w=${width}&q=80&auto=format`;
}
