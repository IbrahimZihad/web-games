"use client";

import { useEffect, useState } from "react";
import Link from "next/link";
import { Compass, Crosshair, Flag, Gamepad2, Puzzle, Sparkles, Swords, Trophy, Users } from "lucide-react";
import { useApp } from "@/components/providers";
import { graphqlRequest } from "@/lib/client-graphql";
import type { CategoryDTO, GameDTO } from "@/lib/types";
import { GameRow } from "@/components/game-row";

const icons: Record<string, typeof Gamepad2> = {
  swords: Swords, compass: Compass, flag: Flag, puzzle: Puzzle, crosshair: Crosshair,
  trophy: Trophy, users: Users, brain: Sparkles, sparkles: Sparkles, gamepad: Gamepad2,
};

const accents = [
  "from-violet-500/20 to-indigo-500/5 text-violet-300",
  "from-emerald-500/20 to-teal-500/5 text-emerald-300",
  "from-rose-500/20 to-orange-500/5 text-rose-300",
  "from-cyan-500/20 to-blue-500/5 text-cyan-300",
  "from-amber-500/20 to-yellow-500/5 text-amber-300",
  "from-lime-500/20 to-green-500/5 text-lime-300",
  "from-fuchsia-500/20 to-purple-500/5 text-fuchsia-300",
  "from-blue-500/20 to-indigo-500/5 text-blue-300",
  "from-orange-500/20 to-amber-500/5 text-orange-300",
];

export function CategoryTiles({ categories }: { categories: CategoryDTO[] }) {
  return (
    <section className="mt-10 sm:mt-14">
      <div className="mb-5"><p className="eyebrow">Find your vibe</p><h2 className="mt-1 text-xl font-bold tracking-tight text-white sm:text-2xl">Browse by category</h2></div>
      <div className="no-scrollbar flex gap-3 overflow-x-auto pb-2">
        {categories.map((category, index) => {
          const Icon = icons[category.iconName] || Gamepad2;
          return (
            <Link key={category.id} href={`/category/${category.slug}`} className="group flex min-w-[154px] flex-1 items-center gap-3 rounded-xl border border-white/[0.065] bg-white/[0.025] p-3.5 transition hover:-translate-y-0.5 hover:border-violet-400/20 hover:bg-white/[0.05]">
              <span className={`grid size-10 shrink-0 place-items-center rounded-lg bg-gradient-to-br ${accents[index % accents.length]}`}><Icon size={19} /></span>
              <span><span className="block text-sm font-bold text-zinc-200 group-hover:text-white">{category.name}</span><span className="mt-0.5 block text-[11px] text-zinc-600">{category.gameCount} games</span></span>
            </Link>
          );
        })}
      </div>
    </section>
  );
}

export function ContinuePlaying() {
  const { history } = useApp();
  const [games, setGames] = useState<GameDTO[]>([]);
  const ids = history.map((item) => item.gameId).join(",");

  useEffect(() => {
    if (!ids) return;
    let active = true;
    graphqlRequest<{ gamesByIds: GameDTO[] }>(
      `query ContinueGames($ids: [ID!]!) { gamesByIds(ids: $ids) { id title slug thumbnailUrl previewVideoUrl posterUrl tagline description controlsGuide developerName category { id name slug iconName gameCount } tags { id name slug } sourceType embedUrl aspectRatio orientation supportsMobile screenshots status isFeatured isTrending playCount likesCount dislikesCount publishedAt createdAt updatedAt comments { id body createdAt user { id username avatarUrl role } } similarGames { id } } }`,
      { ids: ids.split(",") },
    ).then((data) => { if (active) setGames(data.gamesByIds); }).catch(() => { if (active) setGames([]); });
    return () => { active = false; };
  }, [ids]);

  if (!games.length) return null;
  return <GameRow title="Jump back in" subtitle="Pick up where you left off." games={games} href="/recently-played" />;
}
