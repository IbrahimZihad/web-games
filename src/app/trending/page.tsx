import type { Metadata } from "next";
import { BrowseView } from "@/components/browse-view";
import { getGames } from "@/lib/data";

export const dynamic = "force-dynamic";
export const metadata: Metadata = { title: "Trending games" };

export default async function TrendingPage() {
  const games = await getGames({ trending: true, sort: "popular", limit: 60 });
  return <BrowseView title="Trending now" eyebrow="What’s hot" description="See what the community is playing right now, ranked by real play counts." games={games} />;
}
