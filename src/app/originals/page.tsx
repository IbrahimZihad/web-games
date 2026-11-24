import type { Metadata } from "next";
import { BrowseView } from "@/components/browse-view";
import { getGames } from "@/lib/data";

export const dynamic = "force-dynamic";
export const metadata: Metadata = { title: "Nexus Originals" };

export default async function OriginalsPage() {
  const games = await getGames({ featured: true, sort: "popular", limit: 60 });
  return <BrowseView title="Nexus Originals" eyebrow="Handpicked" description="Standout games selected by the Nexus team for their quality, creativity, and pure fun." games={games} />;
}
