import type { Metadata } from "next";
import { notFound } from "next/navigation";
import { BrowseView } from "@/components/browse-view";
import { JsonLd } from "@/components/json-ld";
import { getCategories, getGames } from "@/lib/data";
import { breadcrumbJsonLd, buildMetadata, categoryMetadata, collectionJsonLd } from "@/lib/seo";

export const dynamic = "force-dynamic";

export async function generateMetadata({ params }: { params: Promise<{ slug: string }> }): Promise<Metadata> {
  const { slug } = await params;
  const category = (await getCategories()).find((item) => item.slug === slug);
  if (!category) {
    return buildMetadata({
      title: "Category not found",
      description: "The requested game category is not available on Nexus Play.",
      path: `/category/${slug}`,
      noindex: true,
    });
  }
  return categoryMetadata(category, category.gameCount === 0);
}

export default async function CategoryPage({ params }: { params: Promise<{ slug: string }> }) {
  const { slug } = await params;
  const [category, categories] = await Promise.all([
    getCategories().then((items) => items.find((item) => item.slug === slug)),
    getCategories(),
  ]);
  if (!category || category.gameCount === 0) notFound();
  const games = await getGames({ categorySlug: slug, limit: 60 });
  if (!games.length) notFound();
  const description = category.description || `Explore the best ${category.name.toLowerCase()} games on Nexus.`;

  return (
    <>
      <JsonLd
        data={[
          collectionJsonLd(games, `${category.name} games`, description, `/category/${category.slug}`),
          breadcrumbJsonLd([
            { name: "Home", path: "/" },
            { name: "Games", path: "/games" },
            { name: category.name, path: `/category/${category.slug}` },
          ]),
        ]}
      />
      <BrowseView title={category.name} eyebrow="Category" description={description} games={games} categories={categories} />
    </>
  );
}
