import type { Metadata } from "next";
import { BrowseView } from "@/components/browse-view";
import { getCategories, getGames } from "@/lib/data";

export const dynamic = "force-dynamic";
export const metadata: Metadata = { title: "All games" };

export default async function GamesPage() {
  const [games, categories] = await Promise.all([getGames({ limit: 60 }), getCategories()]);
  return <BrowseView title="All games" eyebrow="The arcade" description="Every game in the Nexus library, ready to run instantly in your browser." games={games} categories={categories} />;
}
