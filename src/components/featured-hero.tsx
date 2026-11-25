"use client";

import { useEffect, useState } from "react";
import Image from "next/image";
import Link from "next/link";
import { Bookmark, Check, ChevronLeft, ChevronRight, Play, Star } from "lucide-react";
import { useApp } from "@/components/providers";
import { cn, formatCompact } from "@/lib/format";
import type { GameDTO } from "@/lib/types";

export function FeaturedHero({ games }: { games: GameDTO[] }) {
  const [active, setActive] = useState(0);
  const [paused, setPaused] = useState(false);
  const { isFavorite, toggleFavorite, notify } = useApp();
  const game = games[active];

  useEffect(() => {
    if (paused || games.length < 2) return;
    const timer = window.setInterval(() => setActive((current) => (current + 1) % games.length), 8000);
    return () => window.clearInterval(timer);
  }, [games.length, paused]);

  if (!game) return null;
  const saved = isFavorite(game.id);
  const positive = game.likesCount + game.dislikesCount > 0 ? Math.round((game.likesCount / (game.likesCount + game.dislikesCount)) * 100) : 0;

  function move(direction: number) {
    setActive((current) => (current + direction + games.length) % games.length);
  }

  async function save() {
    try { await toggleFavorite(game.id); } catch { notify("The favorite could not be updated.", "error"); }
  }

  return (
    <section className="relative" onMouseEnter={() => setPaused(true)} onMouseLeave={() => setPaused(false)} aria-roledescription="carousel" aria-label="Featured games">
      <div className="portal-grid pointer-events-none absolute inset-0 rounded-3xl opacity-60" />
      <div className="relative overflow-hidden rounded-2xl border border-white/[0.08] bg-[#141622] shadow-2xl shadow-black/30 sm:rounded-3xl">
        {games.map((item, index) => (
          <Image key={item.id} src={item.thumbnailUrl} alt="" fill priority={index === 0} sizes="(max-width: 768px) 100vw, 85vw" className={cn("object-cover object-center transition-all duration-1000", index === active ? "scale-100 opacity-100" : "scale-105 opacity-0")} />
        ))}
        <div className="hero-vignette absolute inset-0" />
        <div className="relative flex min-h-[390px] max-w-2xl flex-col justify-center px-6 py-10 sm:min-h-[440px] sm:px-10 lg:px-14">
          <div key={game.id} className="animate-fade-up">
            <div className="mb-5 flex flex-wrap items-center gap-2">
              <span className="rounded-md bg-violet-500/15 px-2.5 py-1 text-[10px] font-black uppercase tracking-[0.16em] text-violet-200 ring-1 ring-inset ring-violet-400/20">Editor&apos;s pick</span>
              <span className="rounded-md border border-white/10 bg-black/20 px-2.5 py-1 text-[10px] font-bold uppercase tracking-wider text-zinc-300">{game.category.name}</span>
              {game.supportsMobile && <span className="rounded-md border border-emerald-300/15 bg-emerald-500/10 px-2.5 py-1 text-[10px] font-bold uppercase tracking-wider text-emerald-300">Mobile ready</span>}
            </div>
            <h1 className="max-w-xl text-3xl font-black leading-[0.98] tracking-[-0.045em] text-white sm:text-4xl">Free HTML5 browser games</h1>
            <h2 className="mt-3 max-w-xl text-4xl font-black leading-[0.98] tracking-[-0.045em] text-white sm:text-6xl lg:text-7xl">{game.title}</h2>
            <p className="mt-4 max-w-md text-sm font-medium leading-6 text-zinc-300 sm:text-base">{game.tagline}</p>
            <div className="mt-5 flex flex-wrap items-center gap-x-5 gap-y-2 text-xs font-semibold text-zinc-400">
              <span className="flex items-center gap-1.5 text-amber-300"><Star size={14} fill="currentColor" />{positive}% positive</span>
              <span>{formatCompact(game.playCount)} plays</span>
              <span>{game.developerName}</span>
            </div>
            <div className="mt-7 flex flex-wrap items-center gap-3">
              <Link href={`/games/${game.slug}`} className="primary-button h-12 px-6 text-sm"><Play size={17} fill="currentColor" />Play now</Link>
              <button onClick={save} className="secondary-button h-12 px-4 text-sm">{saved ? <Check size={17} className="text-violet-300" /> : <Bookmark size={17} />}{saved ? "Saved" : "Favorite"}</button>
            </div>
          </div>
        </div>
        {games.length > 1 && (
          <>
            <div className="absolute bottom-6 right-6 hidden items-center gap-2 sm:flex">
              <button onClick={() => move(-1)} className="icon-button bg-black/30" aria-label="Previous featured game"><ChevronLeft size={18} /></button>
              <button onClick={() => move(1)} className="icon-button bg-black/30" aria-label="Next featured game"><ChevronRight size={18} /></button>
            </div>
            <div className="absolute bottom-7 right-7 flex gap-2 sm:hidden">
              {games.map((item, index) => <button key={item.id} onClick={() => setActive(index)} aria-label={`Show ${item.title}`} className={cn("h-1.5 rounded-full transition-all", index === active ? "w-6 bg-violet-400" : "w-1.5 bg-white/30")} />)}
            </div>
          </>
        )}
      </div>
      {games.length > 1 && <div className="mt-4 flex items-center justify-center gap-2">{games.map((item, index) => <button key={item.id} onClick={() => setActive(index)} aria-label={`Show ${item.title}`} className={cn("h-1 rounded-full transition-all", index === active ? "w-8 bg-violet-400" : "w-4 bg-white/10 hover:bg-white/25")} />)}</div>}
    </section>
  );
}
