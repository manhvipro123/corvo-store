import Link from "next/link";
import { ArrowRight } from "lucide-react";

import { Container } from "@/components/ui/container";
import { Section } from "@/components/ui/section";
import { getCategories } from "@/db/queries";
import { categoryHref } from "@/lib/catalog";

/** Text-led category directory: large names on hairline rows. */
export async function CategoryIndex() {
  const categories = await getCategories();

  return (
    <Section aria-labelledby="category-index-title">
      <Container className="grid gap-6 lg:grid-cols-4 lg:gap-8">
        <h2 id="category-index-title" className="text-heading lg:pt-6">
          Shop by category
        </h2>
        <ul className="border-border border-t lg:col-span-3">
          {categories.map((category, index) => (
            <li key={category.slug} className="border-border border-b">
              <Link
                href={categoryHref(category.slug)}
                className="group flex items-baseline gap-4 py-4 md:gap-8 md:py-6"
              >
                <span className="text-meta text-muted w-6 tabular-nums">
                  {String(index + 1).padStart(2, "0")}
                </span>
                <span className="text-display flex-1 transition-transform duration-300 group-hover:translate-x-2">
                  {category.name}
                </span>
                <ArrowRight
                  className="size-5 self-center opacity-0 transition-opacity duration-300 group-hover:opacity-100 max-md:opacity-100"
                  strokeWidth={1.25}
                  aria-hidden
                />
              </Link>
            </li>
          ))}
        </ul>
      </Container>
    </Section>
  );
}
