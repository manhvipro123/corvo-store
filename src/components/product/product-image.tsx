import Image from "next/image";

import { cn } from "@/lib/utils";
import type { ImageAsset } from "@/types/catalog";

/**
 * Product shot in a sized, `relative` parent (e.g. `MediaFrame`). Uses the
 * image's own `fit` unless overridden. When contained, the piece is inset on
 * the light `stage` colour and `multiply` melts the photo's white backdrop
 * into it, in both colour schemes, so tiles read as one set. (Multiplying
 * onto the dark surface would blacken the photo instead.)
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
  const img = (
    <Image
      src={image.src}
      alt={image.alt}
      fill
      sizes={sizes}
      preload={preload}
      className={cn(
        fit === "cover"
          ? "object-cover"
          : "object-contain p-[8%] mix-blend-multiply",
        className,
      )}
    />
  );

  if (fit === "cover") return img;

  // `isolate` keeps the blend inside the stage, never against the page.
  return <div className="bg-stage absolute inset-0 isolate">{img}</div>;
}
