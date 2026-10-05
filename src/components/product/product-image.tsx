import Image from "next/image";

import { cn } from "@/lib/utils";
import type { ImageAsset } from "@/types/catalog";

/**
 * Product shot in a sized, `relative` parent (e.g. `MediaFrame`). Uses the
 * image's own `fit` unless overridden. When contained, the piece is inset on
 * the surface colour and, in light mode, `multiply` melts the photo's white
 * backdrop into that surface so tiles read as one set.
 */
export function ProductImage({
  image,
  sizes,
  preload,
  fit = image.fit ?? "contain",
  className,
}: {
  image: ImageAsset;
  sizes: string;
  preload?: boolean;
  fit?: ImageAsset["fit"];
  className?: string;
}) {
  return (
    <Image
      src={image.src}
      alt={image.alt}
      fill
      sizes={sizes}
      preload={preload}
      className={cn(
        fit === "cover"
          ? "object-cover"
          : "object-contain p-[8%] mix-blend-multiply dark:mix-blend-normal",
        className,
      )}
    />
  );
}
