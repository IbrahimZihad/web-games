import { CategoriesManager } from "@/components/admin/categories-manager";
import { getAdminCategories, getAdminErrorMessage, getAdminTags } from "@/lib/admin-graphql";

export default async function AdminCategoriesPage() {
  const [categoriesResult, tagsResult] = await Promise.allSettled([
    getAdminCategories(),
    getAdminTags(),
  ]);

  return (
    <CategoriesManager
      initialCategories={categoriesResult.status === "fulfilled" ? categoriesResult.value : []}
      initialTags={tagsResult.status === "fulfilled" ? tagsResult.value : []}
      initialCategoryError={categoriesResult.status === "rejected" ? getAdminErrorMessage(categoriesResult.reason) : ""}
      initialTagError={tagsResult.status === "rejected" ? getAdminErrorMessage(tagsResult.reason) : ""}
    />
  );
}
