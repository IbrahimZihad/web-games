import { BrowseView } from "@/components/browse-view";
import { JsonLd } from "@/components/json-ld";
import { getGames } from "@/lib/data";
import { buildMetadata, collectionJsonLd } from "@/lib/seo";

export const dynamic = "force-dynamic";

export const metadata = buildMetadata({
  title: "Nexus Originals — Handpicked Browser Games",
  description:
    "Explore handpicked original browser games on Nexus Play. Enjoy standout HTML5 games selected for quality, creativity, and instant play with no downloads.",
  path: "/originals",
  keywords: ["Nexus Originals", "original browser games", "handpicked HTML5 games", "featured online games", "free arcade games"],
});

export default async function OriginalsPage() {
  const games = await getGames({ featured: true, sort: "popular", limit: 60 });
  return (
    <>
      <JsonLd data={collectionJsonLd(games, "Nexus Originals", "Handpicked browser games selected by the Nexus Play team.", "/originals")} />
      <BrowseView title="Nexus Originals" eyebrow="Handpicked" description="Standout games selected by the Nexus team for their quality, creativity, and pure fun." games={games} />
    </>
  );
}
