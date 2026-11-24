import type { Metadata } from "next";
import { BrowseView } from "@/components/browse-view";
import { getGames } from "@/lib/data";

export const dynamic = "force-dynamic";
export const metadata: Metadata = { title: "New releases" };

export default async function NewPage() {
  const games = await getGames({ sort: "newest", limit: 60 });
  return <BrowseView title="New releases" eyebrow="Just landed" description="The latest additions to the arcade. Be the first to discover a new favorite." games={games} />;
}
