import { ProductImage } from "@/components/product/product-image";
import type { ImageAsset } from "@/types/catalog";

/**
 * Product imagery. On desktop each frame fills the viewport below the
 * header so the whole piece is visible without scrolling; on smaller
 * screens frames are 4:5 and full width.
 */
export function ProductGallery({ images }: { images: ImageAsset[] }) {
  return (
    <ul className="grid gap-px">
      {images.map((image, index) => (
        <li
          key={image.src}
          className="bg-surface relative aspect-[4/5] md:aspect-[4/3] lg:aspect-auto lg:h-[calc(100svh-var(--header-height))] lg:min-h-[36rem]"
        >
          {/* Always the whole piece here, whatever the tile fit. */}
          <ProductImage
            image={image}
            fit="contain"
            preload={index === 0}
            className="p-[4%] lg:p-[6%]"
            sizes="(min-width: 1024px) 58vw, 100vw"
          />
        </li>
      ))}
    </ul>
  );
}
