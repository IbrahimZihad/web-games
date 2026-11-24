import type { Metadata } from "next";
import { BrowseView } from "@/components/browse-view";
import { getGames } from "@/lib/data";

export const dynamic = "force-dynamic";
export const metadata: Metadata = { title: "Search" };

export default async function SearchPage({ searchParams }: { searchParams: Promise<{ q?: string }> }) {
  const { q = "" } = await searchParams;
  const games = q.trim() ? await getGames({ search: q.trim(), limit: 60 }) : [];
  return <BrowseView title={q.trim() ? `Results for “${q.trim()}”` : "Search the arcade"} eyebrow="Search" description={q.trim() ? "Games matching your search across titles, descriptions, categories, and tags." : "Use the search bar above to find your next game."} games={games} />;
}
