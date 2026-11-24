import type { Metadata } from "next";
import { BrowseView } from "@/components/browse-view";
import { getGames } from "@/lib/data";

export const dynamic = "force-dynamic";
export const metadata: Metadata = { title: "Recently updated" };

export default async function UpdatedPage() {
  const games = await getGames({ sort: "updated", limit: 60 });
  return <BrowseView title="Recently updated" eyebrow="Fresh builds" description="Games with the most recent updates and improvements from their developers." games={games} />;
}
