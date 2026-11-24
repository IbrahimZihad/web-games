"use client";

import { useEffect, useState } from "react";
import Link from "next/link";
import { Bookmark, Clock3, Gamepad2 } from "lucide-react";
import { useApp } from "@/components/providers";
import { GameGrid } from "@/components/game-row";
import { gameFragment, graphqlRequest } from "@/lib/client-graphql";
import type { GameDTO } from "@/lib/types";

export function LibraryGrid({ type }: { type: "favorites" | "history" }) {
  const { favoriteIds, history } = useApp();
  const [result, setResult] = useState<{ key: string; games: GameDTO[] } | null>(null);
  const ids = type === "favorites" ? favoriteIds : history.map((item) => item.gameId);
  const key = ids.join(",");

  useEffect(() => {
    if (!key) return;
    let active = true;
    graphqlRequest<{ gamesByIds: GameDTO[] }>(`query LibraryGames($ids: [ID!]!) { gamesByIds(ids: $ids) { ...GameFields } } ${gameFragment}`, { ids: key.split(",") })
      .then((data) => { if (active) setResult({ key, games: data.gamesByIds }); })
      .catch(() => { if (active) setResult({ key, games: [] }); });
    return () => { active = false; };
  }, [key]);

  const loading = Boolean(key) && result?.key !== key;
  const games = result?.key === key ? result.games : [];

  if (loading) return <div className="grid grid-cols-2 gap-4 sm:grid-cols-3 lg:grid-cols-4 xl:grid-cols-5">{[1, 2, 3, 4, 5].map((item) => <div key={item} className="skeleton aspect-video rounded-xl" />)}</div>;
  if (!games.length) return (
    <div className="flex min-h-[360px] flex-col items-center justify-center rounded-2xl border border-dashed border-white/10 bg-white/[0.015] px-6 text-center">
      <span className="grid size-16 place-items-center rounded-2xl bg-violet-500/10 text-violet-300">{type === "favorites" ? <Bookmark size={28} /> : <Clock3 size={28} />}</span>
      <h2 className="mt-5 text-xl font-bold text-white">{type === "favorites" ? "Your favorites start here" : "No games played yet"}</h2>
      <p className="mt-2 max-w-sm text-sm leading-6 text-zinc-500">{type === "favorites" ? "Bookmark games you love and they will appear here, even before you create an account." : "Play any game and it will be added to your recent history automatically."}</p>
      <Link href="/games" className="primary-button mt-6"><Gamepad2 size={17} />Find a game</Link>
    </div>
  );
  return <GameGrid games={games} />;
}
