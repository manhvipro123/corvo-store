import Image from "next/image";
import Link from "next/link";

import { buttonVariants } from "@/components/ui/button";
import { editorialStory } from "@/data/collections";

/** Magazine-style split: full-height image beside a text column. */
export function EditorialStory() {
  const { eyebrow, title, body, cta, image } = editorialStory;

  return (
    <section className="border-border grid border-y md:grid-cols-2">
      <div className="relative aspect-[4/5] md:aspect-auto md:min-h-[44rem]">
        <Image
          src={image.src}
          alt={image.alt}
          fill
          sizes="(min-width: 768px) 50vw, 100vw"
          className="object-cover"
        />
      </div>
      <div className="px-gutter flex flex-col items-start justify-center gap-5 py-12 md:px-16 md:py-20 xl:px-24">
        <p className="text-label text-muted">{eyebrow}</p>
        <h2 className="text-display max-w-md">{title}</h2>
        <p className="text-body text-muted max-w-prose">{body}</p>
        <Link
          href={cta.href}
          className={buttonVariants({
            variant: "secondary",
            className: "mt-2",
          })}
        >
          {cta.label}
        </Link>
      </div>
    </section>
  );
}
