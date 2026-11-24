"use client";

import { useState } from "react";
import Image from "next/image";
import Link from "next/link";
import { Bookmark, Check, Flame, Play, Sparkles } from "lucide-react";
import { useApp } from "@/components/providers";
import { cn, formatCompact } from "@/lib/format";
import type { GameDTO } from "@/lib/types";

export function GameCard({ game, priority = false }: { game: GameDTO; priority?: boolean }) {
  const { isFavorite, toggleFavorite, notify } = useApp();
  const [hovered, setHovered] = useState(false);
  const saved = isFavorite(game.id);
  const isNew = game.isNew;

  async function save() {
    try {
      await toggleFavorite(game.id);
    } catch {
      notify("The favorite could not be updated.", "error");
    }
  }

  return (
    <article
      className="group relative w-[220px] shrink-0 sm:w-[246px]"
      onMouseEnter={() => setHovered(true)}
      onMouseLeave={() => setHovered(false)}
    >
      <Link href={`/games/${game.slug}`} className="block" onFocus={() => setHovered(true)} onBlur={() => setHovered(false)}>
        <div className="relative aspect-video overflow-hidden rounded-xl border border-white/[0.07] bg-[#181925] shadow-lg shadow-black/10">
          <Image src={game.thumbnailUrl} alt={`${game.title} cover`} fill sizes="246px" priority={priority} className={cn("object-cover transition duration-500", hovered ? "scale-[1.055]" : "scale-100")} />
          {game.previewVideoUrl && hovered && (
            <video src={game.previewVideoUrl} autoPlay muted loop playsInline preload="none" className="absolute inset-0 h-full w-full object-cover opacity-90 transition-opacity duration-300" />
          )}
          <div className="card-vignette absolute inset-0 opacity-70 transition group-hover:opacity-100" />
          <div className="absolute left-2.5 top-2.5 flex gap-1.5">
            {game.isFeatured && <span className="rounded-md border border-violet-300/20 bg-violet-600/85 px-2 py-1 text-[9px] font-black uppercase tracking-wider text-white backdrop-blur-md"><Sparkles size={9} className="mr-1 inline" />Featured</span>}
            {game.isTrending && <span className="rounded-md border border-orange-300/20 bg-orange-600/85 px-2 py-1 text-[9px] font-black uppercase tracking-wider text-white backdrop-blur-md"><Flame size={9} className="mr-1 inline" />Trending</span>}
            {isNew && !game.isFeatured && !game.isTrending && <span className="rounded-md border border-cyan-300/20 bg-cyan-700/85 px-2 py-1 text-[9px] font-black uppercase tracking-wider text-white backdrop-blur-md">New</span>}
          </div>
          <span className={cn("absolute inset-0 m-auto grid size-12 place-items-center rounded-full border border-white/25 bg-white/15 text-white backdrop-blur-md transition duration-300", hovered ? "scale-100 opacity-100" : "scale-75 opacity-0")}><Play size={20} fill="currentColor" className="ml-0.5" /></span>
          <div className="absolute inset-x-3 bottom-2.5 flex items-center justify-between text-[10px] font-semibold text-white/85"><span>{game.category.name}</span><span className="flex items-center gap-1"><Play size={10} fill="currentColor" />{formatCompact(game.playCount)}</span></div>
        </div>
        <div className="px-0.5 pt-3">
          <h3 className="truncate text-[15px] font-bold tracking-tight text-zinc-100 transition group-hover:text-violet-300">{game.title}</h3>
          <p className="mt-1 truncate text-xs text-zinc-600">{game.developerName}</p>
        </div>
      </Link>
      <button
        type="button"
        onClick={save}
        aria-label={saved ? `Remove ${game.title} from favorites` : `Save ${game.title} to favorites`}
        className={cn("absolute right-2.5 top-2.5 z-10 grid size-8 place-items-center rounded-lg border backdrop-blur-md transition", saved ? "border-violet-300/30 bg-violet-600 text-white" : "border-white/10 bg-black/45 text-white/70 opacity-0 hover:bg-black/70 hover:text-white group-hover:opacity-100 focus:opacity-100")}
      >
        {saved ? <Check size={15} /> : <Bookmark size={15} />}
      </button>
    </article>
  );
}
