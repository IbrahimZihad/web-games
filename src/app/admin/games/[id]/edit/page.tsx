import { notFound } from "next/navigation";
import { GameWizard } from "@/components/admin/game-wizard";
import { ErrorState } from "@/components/admin/admin-ui";
import {
  getAdminCategories,
  getAdminErrorMessage,
  getAdminGame,
  getAdminTags,
  type AdminGame,
} from "@/lib/admin-graphql";
import type { CategoryDTO, TagDTO } from "@/lib/types";

export default async function EditGamePage({ params }: { params: Promise<{ id: string }> }) {
  const { id } = await params;
  const numericId = Number(id);
  if (!/^[1-9]\d*$/.test(id) || !Number.isSafeInteger(numericId)) notFound();

  let data: { game: AdminGame | null; categories: CategoryDTO[]; tags: TagDTO[] };
  try {
    const [game, categories, tags] = await Promise.all([
      getAdminGame(id),
      getAdminCategories(),
      getAdminTags(),
    ]);
    data = { game, categories, tags };
  } catch (error) {
    return <ErrorState description={getAdminErrorMessage(error)} />;
  }
  if (!data.game) notFound();
  return <GameWizard key={data.game.id} game={data.game} categories={data.categories} tags={data.tags} />;
}
