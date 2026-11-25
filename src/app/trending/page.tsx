import { BrowseView } from "@/components/browse-view";
import { JsonLd } from "@/components/json-ld";
import { getGames } from "@/lib/data";
import { buildMetadata, collectionJsonLd } from "@/lib/seo";

export const dynamic = "force-dynamic";

export const metadata = buildMetadata({
  title: "Trending Browser Games — Play What’s Popular",
  description:
    "See the most-played free HTML5 games on Nexus Play. Discover trending browser games ranked by real play counts and start playing instantly.",
  path: "/trending",
  keywords: ["trending browser games", "popular HTML5 games", "most played games", "online arcade trends", "free games online"],
});

export default async function TrendingPage() {
  const games = await getGames({ trending: true, sort: "popular", limit: 60 });
  return (
    <>
      <JsonLd data={collectionJsonLd(games, "Trending browser games", "Popular Nexus Play games ranked by play counts.", "/trending")} />
      <BrowseView title="Trending now" eyebrow="What’s hot" description="See what the community is playing right now, ranked by real play counts." games={games} />
    </>
  );
}
