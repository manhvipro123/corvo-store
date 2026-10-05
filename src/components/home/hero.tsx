import Image from "next/image";
import Link from "next/link";

import { buttonVariants } from "@/components/ui/button";
import { Container } from "@/components/ui/container";
import { heroCampaign } from "@/data/collections";

export function Hero() {
  const { eyebrow, title, cta, image } = heroCampaign;

  return (
    <section className="relative h-[calc(100svh-var(--header-height))] min-h-[32rem] overflow-hidden bg-black">
      <Image
        src={image.src}
        alt={image.alt}
        fill
        preload
        sizes="100vw"
        className="object-cover object-[50%_20%]"
      />
      <div className="absolute inset-0 bg-linear-to-t from-black/60 via-black/10 to-transparent" />
      <Container className="relative flex h-full flex-col items-start justify-end gap-4 pb-10 text-white md:pb-16">
        <p className="text-label">{eyebrow}</p>
        <h1 className="text-display max-w-xl">{title}</h1>
        <Link
          href={cta.href}
          className={buttonVariants({ variant: "inverse", className: "mt-2" })}
        >
          {cta.label}
        </Link>
      </Container>
    </section>
  );
}
