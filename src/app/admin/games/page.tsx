import { GamesManager } from "@/components/admin/games-manager";
import { getAdminErrorMessage, getAdminGames } from "@/lib/admin-graphql";

export default async function AdminGamesPage() {
  let games: Awaited<ReturnType<typeof getAdminGames>> = [];
  let initialError = "";

  try {
    games = await getAdminGames();
  } catch (error) {
    initialError = getAdminErrorMessage(error);
  }

  return <GamesManager initialGames={games} initialError={initialError} />;
}
