import Image from "next/image";
import Link from "next/link";

import { featuredCollections } from "@/data/collections";

/**
 * Two large editorial tiles side by side; stacked on mobile. Type stays
 * small so the photography carries the section and the hero keeps the only
 * display-size headline above the fold.
 */
export function FeaturedCollections() {
  return (
    <section
      aria-label="Featured collections"
      className="grid gap-px md:grid-cols-2"
    >
      {featuredCollections.map((collection) => (
        <Link
          key={collection.slug}
          href={collection.href}
          className="group relative block aspect-[4/5] overflow-hidden bg-black md:aspect-[3/4]"
        >
          <Image
            src={collection.image.src}
            alt={collection.image.alt}
            fill
            sizes="(min-width: 768px) 50vw, 100vw"
            className="object-cover transition-transform duration-700 ease-out group-hover:scale-[1.03]"
          />
          <div className="absolute inset-0 bg-linear-to-t from-black/50 via-transparent to-transparent" />
          <div className="px-gutter absolute inset-x-0 bottom-0 flex flex-col items-start gap-2 pb-8 text-white md:px-8 md:pb-10">
            <h2 className="text-heading">{collection.title}</h2>
            <p className="text-meta max-w-xs text-white/80">
              {collection.description}
            </p>
            <span className="text-label mt-3 underline underline-offset-4">
              Explore
            </span>
          </div>
        </Link>
      ))}
    </section>
  );
}
