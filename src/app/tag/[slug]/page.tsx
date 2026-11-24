import type { Metadata } from "next";
import { notFound } from "next/navigation";
import { BrowseView } from "@/components/browse-view";
import { getGames, getTags } from "@/lib/data";

export const dynamic = "force-dynamic";

export async function generateMetadata({ params }: { params: Promise<{ slug: string }> }): Promise<Metadata> {
  const { slug } = await params;
  const tag = (await getTags()).find((item) => item.slug === slug);
  return { title: tag?.name || "Tag" };
}

export default async function TagPage({ params }: { params: Promise<{ slug: string }> }) {
  const { slug } = await params;
  const tag = (await getTags()).find((item) => item.slug === slug);
  if (!tag) notFound();
  const games = await getGames({ tagSlug: slug, limit: 60 });
  return <BrowseView title={`Tagged ${tag.name}`} eyebrow="Explore a tag" description={`Discover every Nexus game tagged ${tag.name}.`} games={games} />;
}
