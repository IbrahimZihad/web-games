import type { Metadata } from "next";
import { notFound } from "next/navigation";
import { BrowseView } from "@/components/browse-view";
import { getCategories, getGames } from "@/lib/data";

export const dynamic = "force-dynamic";

export async function generateMetadata({ params }: { params: Promise<{ slug: string }> }): Promise<Metadata> {
  const { slug } = await params;
  const category = (await getCategories()).find((item) => item.slug === slug);
  return { title: category?.name || "Category" };
}

export default async function CategoryPage({ params }: { params: Promise<{ slug: string }> }) {
  const { slug } = await params;
  const [category, categories] = await Promise.all([
    getCategories().then((items) => items.find((item) => item.slug === slug)),
    getCategories(),
  ]);
  if (!category) notFound();
  const games = await getGames({ categorySlug: slug, limit: 60 });
  return <BrowseView title={category.name} eyebrow="Category" description={category.description || `Explore the best ${category.name.toLowerCase()} games on Nexus.`} games={games} categories={categories} />;
}
