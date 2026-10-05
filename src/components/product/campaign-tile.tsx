import Image from "next/image";
import Link from "next/link";

import type { ImageAsset } from "@/types/catalog";

/**
 * Editorial image placed inside the product grid to break its rhythm.
 * Spans two columns everywhere and two rows from `lg` (where it sits on the
 * right, as in the homepage `ProductFeature`). Render it as a grid `<li>`.
 */
export function CampaignTile({
  title,
  href,
  image,
  headingLevel: Heading = "h2",
}: {
  title: string;
  href: string;
  image: ImageAsset;
  /** Use "h3" when the tile sits under a section's own h2. */
  headingLevel?: "h2" | "h3";
}) {
  return (
    <li className="col-span-2 lg:col-start-3 lg:row-span-2">
      <Link
        href={href}
        className="group relative block aspect-[4/5] h-full overflow-hidden bg-black md:aspect-[3/2] lg:aspect-auto"
      >
        <Image
          src={image.src}
          alt={image.alt}
          fill
          sizes="(min-width: 1024px) 50vw, 100vw"
          className="object-cover transition-transform duration-700 ease-out group-hover:scale-[1.03]"
        />
        <div className="absolute inset-0 bg-linear-to-t from-black/45 via-transparent to-transparent" />
        <div className="absolute inset-x-0 bottom-0 flex flex-col items-start gap-2 px-4 pb-6 text-white md:px-6 md:pb-8">
          <Heading className="text-heading">{title}</Heading>
          <span className="text-label underline underline-offset-4">
            Explore
          </span>
        </div>
      </Link>
    </li>
  );
}
