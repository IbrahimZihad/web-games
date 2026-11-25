import { FeaturedHero } from "@/components/featured-hero";
import { CategoryTiles, ContinuePlaying } from "@/components/category-tiles";
import { GameRow } from "@/components/game-row";
import { JsonLd } from "@/components/json-ld";
import { getGames, getHomeFeed } from "@/lib/data";
import { buildMetadata, collectionJsonLd } from "@/lib/seo";

export const dynamic = "force-dynamic";

export const metadata = buildMetadata({
  title: "Nexus Play — Free HTML5 Browser Games",
  description:
    "Play free HTML5 browser games instantly. Discover trending arcade games, save favorites, and enjoy original games with no downloads or installs.",
  path: "/",
  keywords: [
    "Nexus Play",
    "free HTML5 browser games",
    "play free games online",
    "browser games no download",
    "instant play games",
    "online arcade games",
    "HTML5 games",
  ],
});

export default async function HomePage() {
  const [feed, topRated] = await Promise.all([getHomeFeed(), getGames({ sort: "rating", limit: 12 })]);
  const featuredGames = Array.from(
    new Map([...feed.featured, ...feed.trending, ...feed.newReleases].map((game) => [game.id, game])).values(),
  ).slice(0, 12);

  return (
    <div>
      <JsonLd
        data={collectionJsonLd(
          featuredGames,
          "Free HTML5 browser games",
          "Trending, new, and original browser games available to play instantly on Nexus Play.",
          "/",
        )}
      />
      <FeaturedHero games={feed.featured} />
      <CategoryTiles categories={feed.categoryRows.map((row) => row.category)} />
      <ContinuePlaying />
      <GameRow title="Trending now" subtitle="The games everyone is talking about." games={feed.trending} href="/trending" />
      <GameRow title="New releases" subtitle="Fresh challenges. Zero downloads." games={feed.newReleases} href="/new" />
      <GameRow title="Top rated" subtitle="Player favorites, ranked by love." games={topRated} href="/games" label="Browse all" />
      {feed.categoryRows.slice(0, 4).map((row) => (
        <GameRow key={row.category.id} title={`More ${row.category.name.toLowerCase()}`} subtitle={row.category.description || undefined} games={row.games} href={`/category/${row.category.slug}`} />
      ))}
      <section className="relative mt-16 overflow-hidden rounded-2xl border border-violet-400/15 bg-gradient-to-r from-violet-600/15 via-indigo-600/10 to-transparent px-6 py-10 sm:px-10">
        <div className="absolute -right-16 -top-24 size-72 rounded-full bg-violet-500/15 blur-3xl" />
        <div className="relative max-w-xl"><p className="eyebrow">Made for players</p><h2 className="mt-2 text-2xl font-black tracking-tight text-white sm:text-3xl">No installs. No waiting. Just one more game.</h2><p className="mt-3 text-sm leading-6 text-zinc-400">Every game runs right in your browser. Your favorites and play history follow you when you sign in.</p></div>
      </section>
    </div>
  );
}
