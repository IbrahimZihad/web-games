import { GameWizard } from "@/components/admin/game-wizard";
import { ErrorState } from "@/components/admin/admin-ui";
import { getAdminCategories, getAdminErrorMessage, getAdminTags } from "@/lib/admin-graphql";

export default async function NewGamePage() {
  let categories: Awaited<ReturnType<typeof getAdminCategories>> = [];
  let tags: Awaited<ReturnType<typeof getAdminTags>> = [];
  let errorMessage = "";

  try {
    [categories, tags] = await Promise.all([getAdminCategories(), getAdminTags()]);
  } catch (error) {
    errorMessage = getAdminErrorMessage(error);
  }

  return errorMessage
    ? <ErrorState description={errorMessage} />
    : <GameWizard categories={categories} tags={tags} />;
}
