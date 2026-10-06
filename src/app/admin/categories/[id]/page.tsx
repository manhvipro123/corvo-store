import type { Metadata } from "next";
import { notFound } from "next/navigation";

import { deleteCategory, updateCategory } from "@/app/admin/categories/actions";
import { CategoryForm } from "@/components/admin/category-form";
import { DeleteCategoryForm } from "@/components/admin/delete-category-form";
import { TextLink } from "@/components/ui/text-link";
import { getAdminCategory } from "@/db/queries";
import { adminHref, parseRouteId } from "@/lib/admin";
import { categoryHref } from "@/lib/catalog";
import { requireAdmin } from "@/lib/session";

export const metadata: Metadata = { title: "Admin: Edit category" };

export default async function EditCategoryPage({
  params,
}: PageProps<"/admin/categories/[id]">) {
  const { id: param } = await params;
  await requireAdmin(`/admin/categories/${encodeURIComponent(param)}`);
  const id = parseRouteId(param);
  if (id === undefined) notFound();
  const category = await getAdminCategory(id);
  if (!category) notFound();

  return (
    <div className="flex flex-col gap-16">
      <section>
        <TextLink variant="nav" href="/admin/categories" className="text-muted">
          ← All categories
        </TextLink>
        <div className="mt-6 mb-10 flex flex-col gap-3">
          <h2 className="text-heading">{category.name}</h2>
          <div className="text-meta text-muted flex flex-wrap gap-x-6 gap-y-2">
            <TextLink
              variant="inline"
              href={adminHref("/admin/products", { category: category.slug })}
            >
              {category.productCount}{" "}
              {category.productCount === 1 ? "product" : "products"}
            </TextLink>
            <TextLink variant="inline" href={categoryHref(category.slug)}>
              View in store
            </TextLink>
          </div>
        </div>
        <CategoryForm
          key={category.id}
          action={updateCategory.bind(null, category.id)}
          category={category}
        />
      </section>

      <section className="border-border flex flex-col gap-4 border-t pt-10">
        <h2 className="text-heading">Delete category</h2>
        <p className="text-body text-muted max-w-prose">
          {category.productCount === 0
            ? "This category has no products, so it can be deleted."
            : "Only an empty category can be deleted. Move its products to another category first."}
        </p>
        {category.productCount === 0 && (
          <DeleteCategoryForm
            action={deleteCategory.bind(null, category.id)}
            name={category.name}
          />
        )}
      </section>
    </div>
  );
}
