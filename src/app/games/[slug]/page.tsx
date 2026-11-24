import type { Metadata } from "next";
import { notFound } from "next/navigation";
import { GameExperience } from "@/components/game/game-experience";
import { getGameBySlug } from "@/lib/data";

export const dynamic = "force-dynamic";

export async function generateMetadata({ params }: { params: Promise<{ slug: string }> }): Promise<Metadata> {
  const { slug } = await params;
  const game = await getGameBySlug(slug);
  if (!game) return { title: "Game not found" };
  return {
    title: game.title,
    description: game.tagline || game.description.slice(0, 160),
    openGraph: { title: game.title, description: game.tagline || undefined, images: [game.thumbnailUrl], type: "website" },
  };
}

export default async function GamePage({ params }: { params: Promise<{ slug: string }> }) {
  const { slug } = await params;
  const game = await getGameBySlug(slug);
  if (!game) notFound();
  return <GameExperience game={game} />;
}
