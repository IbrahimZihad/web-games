import { BrowseView } from "@/components/browse-view";
import { getGames } from "@/lib/data";
import { buildMetadata } from "@/lib/seo";

export const dynamic = "force-dynamic";

export const metadata = buildMetadata({
  title: "Search HTML5 Browser Games",
  description: "Search Nexus Play by game title, category, or tag to find your next free browser game.",
  path: "/search",
  keywords: ["search browser games", "find HTML5 games", "online game search"],
  noindex: true,
});

export default async function SearchPage({ searchParams }: { searchParams: Promise<{ q?: string }> }) {
  const { q = "" } = await searchParams;
  const games = q.trim() ? await getGames({ search: q.trim(), limit: 60 }) : [];
  return <BrowseView title={q.trim() ? `Results for “${q.trim()}”` : "Search the arcade"} eyebrow="Search" description={q.trim() ? "Games matching your search across titles, descriptions, categories, and tags." : "Use the search bar above to find your next game."} games={games} />;
}
