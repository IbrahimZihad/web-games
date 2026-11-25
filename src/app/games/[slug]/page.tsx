import type { Metadata } from "next";
import { notFound } from "next/navigation";
import { GameExperience } from "@/components/game/game-experience";
import { JsonLd } from "@/components/json-ld";
import { getGameBySlug } from "@/lib/data";
import { breadcrumbJsonLd, buildMetadata, gameJsonLd, gameMetadata } from "@/lib/seo";

export const dynamic = "force-dynamic";

export async function generateMetadata({ params }: { params: Promise<{ slug: string }> }): Promise<Metadata> {
  const { slug } = await params;
  const game = await getGameBySlug(slug);
  if (!game) {
    return buildMetadata({
      title: "Game not found",
      description: "The requested browser game is not available on Nexus Play.",
      path: `/games/${slug}`,
      noindex: true,
    });
  }
  return gameMetadata(game);
}

export default async function GamePage({ params }: { params: Promise<{ slug: string }> }) {
  const { slug } = await params;
  const game = await getGameBySlug(slug);
  if (!game) notFound();
  return (
    <>
      <JsonLd
        data={[
          gameJsonLd(game),
          breadcrumbJsonLd([
            { name: "Home", path: "/" },
            { name: "Games", path: "/games" },
            { name: game.category.name, path: `/category/${game.category.slug}` },
            { name: game.title, path: `/games/${game.slug}` },
          ]),
        ]}
      />
      <GameExperience game={game} />
    </>
  );
}
