import { BrowseView } from "@/components/browse-view";
import { JsonLd } from "@/components/json-ld";
import { getCategories, getGames } from "@/lib/data";
import { buildMetadata, collectionJsonLd } from "@/lib/seo";

export const dynamic = "force-dynamic";

export const metadata = buildMetadata({
  title: "All Free Browser Games — Play Online",
  description:
    "Browse every free HTML5 game in the Nexus Play library. Find action, racing, puzzle, sports, and arcade games ready to play online with no downloads.",
  path: "/games",
  keywords: [
    "all browser games",
    "free online games",
    "HTML5 games online",
    "play games no download",
    "browser arcade",
    "free games portal",
  ],
});

export default async function GamesPage() {
  const [games, categories] = await Promise.all([getGames({ limit: 60 }), getCategories()]);
  return (
    <>
      <JsonLd
        data={collectionJsonLd(
          games,
          "All free browser games",
          "Every published game in the Nexus Play library, ready to play instantly in a browser.",
          "/games",
        )}
      />
      <BrowseView title="All games" eyebrow="The arcade" description="Every game in the Nexus library, ready to run instantly in your browser." games={games} categories={categories} />
    </>
  );
}
