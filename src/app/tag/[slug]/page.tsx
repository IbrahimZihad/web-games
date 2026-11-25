import type { Metadata } from "next";
import { notFound } from "next/navigation";
import { BrowseView } from "@/components/browse-view";
import { JsonLd } from "@/components/json-ld";
import { getGames, getTags } from "@/lib/data";
import { breadcrumbJsonLd, buildMetadata, collectionJsonLd, tagMetadata } from "@/lib/seo";

export const dynamic = "force-dynamic";

export async function generateMetadata({ params }: { params: Promise<{ slug: string }> }): Promise<Metadata> {
  const { slug } = await params;
  const [tag, games] = await Promise.all([
    getTags().then((items) => items.find((item) => item.slug === slug)),
    getGames({ tagSlug: slug, limit: 1 }),
  ]);
  if (!tag) {
    return buildMetadata({
      title: "Tag not found",
      description: "The requested game tag is not available on Nexus Play.",
      path: `/tag/${slug}`,
      noindex: true,
    });
  }
  return tagMetadata(tag, games.length === 0);
}

export default async function TagPage({ params }: { params: Promise<{ slug: string }> }) {
  const { slug } = await params;
  const tag = (await getTags()).find((item) => item.slug === slug);
  if (!tag) notFound();
  const games = await getGames({ tagSlug: slug, limit: 60 });
  if (!games.length) notFound();
  const description = `Discover every Nexus game tagged ${tag.name}, ready to play free in your browser.`;

  return (
    <>
      <JsonLd
        data={[
          collectionJsonLd(games, `${tag.name} games`, description, `/tag/${tag.slug}`),
          breadcrumbJsonLd([
            { name: "Home", path: "/" },
            { name: "Games", path: "/games" },
            { name: tag.name, path: `/tag/${tag.slug}` },
          ]),
        ]}
      />
      <BrowseView title={`Tagged ${tag.name}`} eyebrow="Explore a tag" description={description} games={games} />
    </>
  );
}
