import { BrowseView } from "@/components/browse-view";
import { JsonLd } from "@/components/json-ld";
import { getGames } from "@/lib/data";
import { buildMetadata, collectionJsonLd } from "@/lib/seo";

export const dynamic = "force-dynamic";

export const metadata = buildMetadata({
  title: "Recently Updated Browser Games — Fresh Builds",
  description:
    "Play recently updated free HTML5 games on Nexus Play. Discover browser games with fresh builds, improvements, and new content ready to play online.",
  path: "/updated",
  keywords: ["updated browser games", "recently updated games", "new game builds", "HTML5 game updates", "free online games"],
});

export default async function UpdatedPage() {
  const games = await getGames({ sort: "updated", limit: 60 });
  return (
    <>
      <JsonLd data={collectionJsonLd(games, "Recently updated browser games", "Nexus Play games with the most recent updates.", "/updated")} />
      <BrowseView title="Recently updated" eyebrow="Fresh builds" description="Games with the most recent updates and improvements from their developers." games={games} />
    </>
  );
}
