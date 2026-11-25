import type { Metadata } from "next";
import type { CategoryDTO, GameDTO, TagDTO } from "@/lib/types";

export const SITE_NAME = "Nexus Play";
export const SITE_DESCRIPTION =
  "Discover and play curated HTML5 games instantly. Save favorites, compete with friends, and find your next obsession on Nexus Play.";
export const SITE_KEYWORDS = [
  "Nexus Play",
  "free HTML5 games",
  "browser games",
  "play games online",
  "no download games",
  "instant play games",
  "online arcade",
  "HTML5 game portal",
  "free browser games",
  "casual games online",
];

export const SOCIAL_IMAGE = {
  url: "/og.png",
  width: 1200,
  height: 630,
  alt: "Nexus Play — instant browser gaming with five original games",
};

const configuredUrl = process.env.NEXT_PUBLIC_APP_URL?.trim() || "http://localhost:3000";
export const SITE_URL = configuredUrl.replace(/\/+$/, "");

export function absoluteUrl(path = "/"): string {
  if (/^https?:\/\//i.test(path)) return path;
  return new URL(path || "/", `${SITE_URL}/`).toString();
}

export function cleanSeoText(value: string): string {
  return value.replace(/\s+/g, " ").trim();
}

export function clampDescription(value: string, fallback = SITE_DESCRIPTION, maxLength = 160): string {
  const normalized = cleanSeoText(value) || fallback;
  if (normalized.length <= maxLength) return normalized;
  const shortened = normalized.slice(0, maxLength - 1);
  const boundary = shortened.lastIndexOf(" ");
  return `${shortened.slice(0, boundary > maxLength * 0.6 ? boundary : shortened.length).trim()}…`;
}

export function uniqueKeywords(values: Array<string | null | undefined>, limit = 24): string[] {
  const seen = new Set<string>();
  const keywords: string[] = [];

  for (const value of values) {
    const keyword = cleanSeoText(value || "");
    const key = keyword.toLowerCase();
    if (!keyword || seen.has(key)) continue;
    seen.add(key);
    keywords.push(keyword);
    if (keywords.length >= limit) break;
  }

  return keywords;
}

type BuildMetadataInput = {
  title: string;
  description: string;
  path: string;
  keywords?: string[];
  image?: string;
  imageAlt?: string;
  imageWidth?: number;
  imageHeight?: number;
  noindex?: boolean;
  type?: "website" | "article";
};

export function buildMetadata({
  title,
  description,
  path,
  keywords = SITE_KEYWORDS,
  image,
  imageAlt,
  imageWidth,
  imageHeight,
  noindex = false,
  type = "website",
}: BuildMetadataInput): Metadata {
  const fullTitle = title.includes(SITE_NAME) ? title : `${title} | ${SITE_NAME}`;
  const resolvedDescription = clampDescription(description);
  const canonical = absoluteUrl(path);
  const resolvedImage = {
    url: absoluteUrl(image || SOCIAL_IMAGE.url),
    alt: imageAlt || SOCIAL_IMAGE.alt,
    ...(image
      ? imageWidth && imageHeight
        ? { width: imageWidth, height: imageHeight }
        : {}
      : { width: SOCIAL_IMAGE.width, height: SOCIAL_IMAGE.height }),
  };

  return {
    title: { absolute: fullTitle },
    description: resolvedDescription,
    keywords: uniqueKeywords(keywords),
    category: "games",
    alternates: { canonical },
    robots: { index: !noindex, follow: true },
    openGraph: {
      title: fullTitle,
      description: resolvedDescription,
      url: canonical,
      siteName: SITE_NAME,
      type,
      locale: "en_US",
      images: [resolvedImage],
    },
    twitter: {
      card: "summary_large_image",
      title: fullTitle,
      description: resolvedDescription,
      images: [resolvedImage],
    },
  };
}

export function gameMetadata(game: GameDTO): Metadata {
  const detail = cleanSeoText(game.tagline || game.description);
  const title = `${game.title} — Play Online Free`;
  const description = clampDescription(`Play ${game.title} online for free in your browser. ${detail}`);
  const keywords = uniqueKeywords([
    game.title,
    `play ${game.title} online`,
    `free ${game.title}`,
    `${game.title} browser game`,
    `${game.category.name} games`,
    ...game.tags.map((tag) => `${tag.name} games`),
    "HTML5 game",
    "browser game",
    "no download",
    ...SITE_KEYWORDS,
  ]);

  return buildMetadata({
    title,
    description,
    path: `/games/${game.slug}`,
    keywords,
    image: game.posterUrl || game.thumbnailUrl,
    imageAlt: `${game.title} browser game preview`,
  });
}

export function categoryMetadata(category: CategoryDTO, noindex = false): Metadata {
  const detail = category.description
    ? cleanSeoText(category.description)
    : `Explore the best ${category.name.toLowerCase()} games, ready to play instantly in your browser.`;
  const title = `${category.name} Games — Play Free Online`;
  const description = clampDescription(`Play free ${category.name} games online with no downloads. ${detail}`);
  const keywords = uniqueKeywords([
    `${category.name} games`,
    `free ${category.name} games`,
    `play ${category.name} games online`,
    `${category.name} browser games`,
    "HTML5 games",
    "no download games",
    ...SITE_KEYWORDS,
  ]);

  return buildMetadata({
    title,
    description,
    path: `/category/${category.slug}`,
    keywords,
    noindex,
  });
}

export function tagMetadata(tag: TagDTO, noindex = false): Metadata {
  const title = `${tag.name} Games — Free Browser Games`;
  const description = clampDescription(
    `Play free ${tag.name} games online. Discover Nexus Play browser games tagged ${tag.name}, with no downloads or installs.`,
  );
  const keywords = uniqueKeywords([
    `${tag.name} games`,
    `free ${tag.name} games`,
    `play ${tag.name} games online`,
    `${tag.name} HTML5 games`,
    "browser games",
    "no download games",
    ...SITE_KEYWORDS,
  ]);

  return buildMetadata({
    title,
    description,
    path: `/tag/${tag.slug}`,
    keywords,
    noindex,
  });
}

export const websiteJsonLd = {
  "@context": "https://schema.org",
  "@type": "WebSite",
  name: SITE_NAME,
  url: absoluteUrl("/"),
  description: SITE_DESCRIPTION,
  inLanguage: "en",
  potentialAction: {
    "@type": "SearchAction",
    target: `${SITE_URL}/search?q={search_term_string}`,
    "query-input": "required name=search_term_string",
  },
};

export function breadcrumbJsonLd(items: ReadonlyArray<{ name: string; path: string }>) {
  return {
    "@context": "https://schema.org",
    "@type": "BreadcrumbList",
    itemListElement: items.map((item, index) => ({
      "@type": "ListItem",
      position: index + 1,
      name: item.name,
      item: absoluteUrl(item.path),
    })),
  };
}

export function itemListJsonLd(games: GameDTO[], name: string, path: string) {
  return {
    "@context": "https://schema.org",
    "@type": "ItemList",
    name,
    url: absoluteUrl(path),
    numberOfItems: games.length,
    itemListElement: games.map((game, index) => ({
      "@type": "ListItem",
      position: index + 1,
      name: game.title,
      url: absoluteUrl(`/games/${game.slug}`),
      image: absoluteUrl(game.posterUrl || game.thumbnailUrl),
    })),
  };
}

export function collectionJsonLd(games: GameDTO[], name: string, description: string, path: string) {
  return {
    "@context": "https://schema.org",
    "@type": "CollectionPage",
    name,
    description: clampDescription(description, SITE_DESCRIPTION, 300),
    url: absoluteUrl(path),
    inLanguage: "en",
    mainEntity: itemListJsonLd(games, name, path),
  };
}

export function gameJsonLd(game: GameDTO) {
  const images = uniqueKeywords([
    game.thumbnailUrl,
    game.posterUrl,
    ...game.screenshots,
  ]).map(absoluteUrl);

  return {
    "@context": "https://schema.org",
    "@type": "VideoGame",
    name: game.title,
    description: clampDescription(game.tagline || game.description, SITE_DESCRIPTION, 500),
    url: absoluteUrl(`/games/${game.slug}`),
    image: images,
    genre: game.category.name,
    keywords: uniqueKeywords([
      game.title,
      game.category.name,
      ...game.tags.map((tag) => tag.name),
      "HTML5",
      "browser game",
    ]).join(", "),
    gamePlatform: "Web browser",
    applicationCategory: "Game",
    operatingSystem: "Any",
    inLanguage: "en",
    isAccessibleForFree: true,
    datePublished: game.publishedAt || game.createdAt,
    dateModified: game.updatedAt,
    offers: {
      "@type": "Offer",
      price: 0,
      priceCurrency: "USD",
    },
    publisher: {
      "@type": "Organization",
      name: SITE_NAME,
      url: absoluteUrl("/"),
    },
  };
}
