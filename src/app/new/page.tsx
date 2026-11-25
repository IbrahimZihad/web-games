import { BrowseView } from "@/components/browse-view";
import { JsonLd } from "@/components/json-ld";
import { getGames } from "@/lib/data";
import { buildMetadata, collectionJsonLd } from "@/lib/seo";

export const dynamic = "force-dynamic";

export const metadata = buildMetadata({
  title: "New HTML5 Games — Latest Browser Releases",
  description:
    "Discover the newest free HTML5 browser games on Nexus Play. Play fresh arcade releases instantly with no downloads or installs.",
  path: "/new",
  keywords: ["new HTML5 games", "latest browser games", "new online games", "free game releases", "no download games"],
});

export default async function NewPage() {
  const games = await getGames({ sort: "newest", limit: 60 });
  return (
    <>
      <JsonLd data={collectionJsonLd(games, "New HTML5 games", "The latest browser game releases on Nexus Play.", "/new")} />
      <BrowseView title="New releases" eyebrow="Just landed" description="The latest additions to the arcade. Be the first to discover a new favorite." games={games} />
    </>
  );
}
