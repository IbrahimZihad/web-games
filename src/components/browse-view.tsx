"use client";

import Link from "next/link";
import { Gamepad2, SearchX } from "lucide-react";
import { GameGrid } from "@/components/game-row";
import type { CategoryDTO, GameDTO } from "@/lib/types";

export function BrowseView({ title, description, games, categories = [], eyebrow = "Discover" }: { title: string; description: string; games: GameDTO[]; categories?: CategoryDTO[]; eyebrow?: string }) {
  return (
    <div>
      <div className="relative overflow-hidden rounded-2xl border border-white/[0.07] bg-gradient-to-br from-[#181927] to-[#11121b] px-6 py-9 sm:px-9 sm:py-11">
        <div className="absolute -right-10 -top-20 size-64 rounded-full bg-violet-500/10 blur-3xl" />
        <p className="eyebrow">{eyebrow}</p>
        <h1 className="mt-2 text-3xl font-black tracking-[-0.035em] text-white sm:text-4xl">{title}</h1>
        <p className="mt-3 max-w-2xl text-sm leading-6 text-zinc-400">{description}</p>
        <p className="mt-5 text-xs font-semibold text-zinc-600">{games.length} game{games.length === 1 ? "" : "s"} ready to play</p>
      </div>
      {categories.length > 0 && (
        <div className="no-scrollbar mt-6 flex gap-2 overflow-x-auto pb-2">
          <Link href="/games" className="shrink-0 rounded-lg border border-white/[0.07] bg-white/[0.03] px-3.5 py-2 text-xs font-semibold text-zinc-400 hover:border-violet-400/30 hover:text-white">All games</Link>
          {categories.map((category) => <Link key={category.id} href={`/category/${category.slug}`} className="shrink-0 rounded-lg border border-white/[0.07] bg-white/[0.03] px-3.5 py-2 text-xs font-semibold text-zinc-400 hover:border-violet-400/30 hover:text-white">{category.name}</Link>)}
        </div>
      )}
      <div className="mt-8">
        {games.length ? <GameGrid games={games} /> : (
          <div className="flex min-h-[340px] flex-col items-center justify-center rounded-2xl border border-dashed border-white/10 bg-white/[0.015] px-6 text-center"><SearchX size={34} className="text-zinc-700" /><h2 className="mt-4 text-lg font-bold text-white">No games found</h2><p className="mt-2 max-w-sm text-sm leading-6 text-zinc-500">Try a different search or explore another category.</p><Link href="/games" className="secondary-button mt-5"><Gamepad2 size={16} />Browse all games</Link></div>
        )}
      </div>
    </div>
  );
}
