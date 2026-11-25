import type { MetadataRoute } from "next";
import { getSeoCatalog } from "@/lib/data";
import { absoluteUrl } from "@/lib/seo";

export const dynamic = "force-dynamic";

export default async function sitemap(): Promise<MetadataRoute.Sitemap> {
  const catalog = await getSeoCatalog();
  const staticPages: MetadataRoute.Sitemap = [
    { url: absoluteUrl("/"), lastModified: new Date(), changeFrequency: "daily", priority: 1 },
    { url: absoluteUrl("/games"), lastModified: new Date(), changeFrequency: "daily", priority: 0.9 },
    { url: absoluteUrl("/trending"), lastModified: new Date(), changeFrequency: "daily", priority: 0.8 },
    { url: absoluteUrl("/new"), lastModified: new Date(), changeFrequency: "daily", priority: 0.8 },
    { url: absoluteUrl("/updated"), lastModified: new Date(), changeFrequency: "weekly", priority: 0.7 },
    { url: absoluteUrl("/originals"), lastModified: new Date(), changeFrequency: "weekly", priority: 0.7 },
  ];

  const gamePages: MetadataRoute.Sitemap = catalog.games.map((game) => ({
    url: absoluteUrl(`/games/${game.slug}`),
    lastModified: game.updatedAt,
    changeFrequency: "weekly",
    priority: 0.8,
    images: [absoluteUrl(game.thumbnailUrl)],
  }));

  const categoryPages: MetadataRoute.Sitemap = catalog.categories
    .filter((category) => category.gameCount > 0)
    .map((category) => ({
      url: absoluteUrl(`/category/${category.slug}`),
      lastModified: category.createdAt,
      changeFrequency: "weekly",
      priority: 0.6,
    }));

  const tagPages: MetadataRoute.Sitemap = catalog.tags
    .filter((tag) => tag.gameCount > 0)
    .map((tag) => ({
      url: absoluteUrl(`/tag/${tag.slug}`),
      changeFrequency: "weekly",
      priority: 0.5,
    }));

  return [...staticPages, ...gamePages, ...categoryPages, ...tagPages];
}
