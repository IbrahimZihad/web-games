"use client";

import { useRef } from "react";
import Link from "next/link";
import { ArrowRight, ChevronLeft, ChevronRight } from "lucide-react";
import { GameCard } from "@/components/game-card";
import type { GameDTO } from "@/lib/types";

export function SectionHeading({ title, subtitle, href, label = "View all" }: { title: string; subtitle?: string; href?: string; label?: string }) {
  return (
    <div className="mb-5 flex items-end justify-between gap-4">
      <div><h2 className="text-xl font-bold tracking-tight text-white sm:text-2xl">{title}</h2>{subtitle && <p className="mt-1 text-sm text-zinc-500">{subtitle}</p>}</div>
      {href && <Link href={href} className="hidden shrink-0 items-center gap-1.5 text-xs font-bold text-zinc-500 transition hover:text-violet-300 sm:flex">{label}<ArrowRight size={14} /></Link>}
    </div>
  );
}

export function GameRow({ title, subtitle, games, href, label }: { title: string; subtitle?: string; games: GameDTO[]; href?: string; label?: string }) {
  const rowRef = useRef<HTMLDivElement>(null);
  if (!games.length) return null;

  function scroll(direction: number) {
    rowRef.current?.scrollBy({ left: direction * Math.min(rowRef.current.clientWidth * 0.85, 800), behavior: "smooth" });
  }

  return (
    <section className="mt-10 sm:mt-12">
      <SectionHeading title={title} subtitle={subtitle} href={href} label={label} />
      <div className="group/row relative">
        <div ref={rowRef} className="no-scrollbar flex gap-4 overflow-x-auto pb-3 sm:gap-5">
          {games.map((game, index) => <GameCard key={game.id} game={game} priority={index < 2} />)}
          {href && <Link href={href} className="flex w-36 shrink-0 flex-col items-center justify-center gap-3 rounded-xl border border-dashed border-white/10 text-center text-xs font-semibold text-zinc-600 transition hover:border-violet-400/30 hover:bg-violet-500/5 hover:text-violet-300"><span className="grid size-10 place-items-center rounded-full bg-white/5"><ArrowRight size={17} /></span>Explore all</Link>}
        </div>
        <button onClick={() => scroll(-1)} aria-label={`Scroll ${title} left`} className="absolute -left-3 top-[38%] hidden size-9 place-items-center rounded-full border border-white/10 bg-[#141622]/95 text-zinc-300 opacity-0 shadow-xl transition hover:text-white group-hover/row:opacity-100 md:grid"><ChevronLeft size={18} /></button>
        <button onClick={() => scroll(1)} aria-label={`Scroll ${title} right`} className="absolute -right-3 top-[38%] hidden size-9 place-items-center rounded-full border border-white/10 bg-[#141622]/95 text-zinc-300 opacity-0 shadow-xl transition hover:text-white group-hover/row:opacity-100 md:grid"><ChevronRight size={18} /></button>
      </div>
    </section>
  );
}

export function GameGrid({ games }: { games: GameDTO[] }) {
  return (
    <div className="grid grid-cols-2 gap-x-3 gap-y-7 sm:grid-cols-3 sm:gap-5 lg:grid-cols-4 xl:grid-cols-5 2xl:grid-cols-6">
      {games.map((game, index) => <div key={game.id} className="min-w-0 [&>article]:w-full"><GameCard game={game} priority={index < 6} /></div>)}
    </div>
  );
}
