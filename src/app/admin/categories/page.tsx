import type { Metadata } from "next";
import Link from "next/link";
import { ChevronRight } from "lucide-react";

import { createCategory } from "@/app/admin/categories/actions";
import { CategoryForm } from "@/components/admin/category-form";
import { EmptyState } from "@/components/admin/empty-state";
import { SectionHeader } from "@/components/ui/section-header";
import { getAdminCategories } from "@/db/queries";
import { requireAdmin } from "@/lib/session";

export const metadata: Metadata = { title: "Admin: Categories" };

export default async function AdminCategoriesPage() {
  await requireAdmin("/admin/categories");
  const categories = await getAdminCategories();

  return (
    <div className="flex flex-col gap-16">
      <section>
        <SectionHeader title="Categories" description="In shop tab order." />
        {categories.length === 0 ? (
          <EmptyState
            title="No categories yet."
            description="Create one below; every product needs a category."
          />
        ) : (
          <ul className="border-border border-t">
            {categories.map((category) => (
              <li key={category.id} className="border-border border-b">
                <Link
                  href={`/admin/categories/${category.id}`}
                  className="group grid grid-cols-[minmax(0,1fr)_auto] items-center gap-x-6 gap-y-1 py-4 sm:grid-cols-[minmax(0,1fr)_7rem_4rem_auto]"
                >
                  <div className="flex min-w-0 flex-col gap-1">
                    <span className="text-meta font-medium">
                      {category.name}
                    </span>
                    <span className="text-meta text-muted truncate">
                      /{category.slug}
                    </span>
                  </div>
                  <span className="text-meta text-muted col-start-1 sm:col-start-auto">
                    {category.productCount}{" "}
                    {category.productCount === 1 ? "product" : "products"}
                  </span>
                  <span className="text-meta text-muted hidden tabular-nums sm:block">
                    <span className="sr-only">Position </span>
                    {category.position}
                  </span>
                  <span className="text-meta text-muted group-hover:text-foreground col-start-2 row-span-2 row-start-1 flex items-center justify-end gap-1 transition-colors sm:col-start-auto sm:row-span-1">
                    Edit
                    <ChevronRight
                      className="size-3.5"
                      strokeWidth={1.5}
                      aria-hidden
                    />
                  </span>
                </Link>
              </li>
            ))}
          </ul>
        )}
      </section>

      <section>
        <SectionHeader title="New category" />
        <CategoryForm action={createCategory} />
      </section>
    </div>
  );
}
