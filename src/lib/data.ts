import { Prisma } from "@prisma/client";
import { unstable_cache } from "next/cache";
import { prisma } from "@/lib/prisma";
import type {
  AdminStats,
  CategoryDTO,
  CommentDTO,
  GameDTO,
  GameFilters,
  GameStatus,
  HomeFeed,
  PublicUser,
  TagDTO,
} from "@/lib/types";

const gameCardInclude = {
  category: true,
  tags: { include: { tag: true }, orderBy: { tag: { name: "asc" } } },
} satisfies Prisma.GameInclude;

const gameDetailInclude = {
  ...gameCardInclude,
  comments: {
    where: { isHidden: false },
    orderBy: { createdAt: "desc" },
    take: 50,
    include: {
      user: { select: { id: true, username: true, avatarUrl: true, role: true } },
    },
  },
} satisfies Prisma.GameInclude;

type GameCardRecord = Prisma.GameGetPayload<{ include: typeof gameCardInclude }>;
type GameDetailRecord = Prisma.GameGetPayload<{ include: typeof gameDetailInclude }>;
type CategoryCounts = ReadonlyMap<number, number>;

const catalogCache = { tags: ["catalog"], revalidate: 30 };
const MAX_LIBRARY_GAMES = 200;

function toCategory(category: GameCardRecord["category"], gameCount: number): CategoryDTO {
  return {
    id: category.id,
    name: category.name,
    slug: category.slug,
    iconName: category.iconName,
    description: category.description,
    displayOrder: category.displayOrder,
    gameCount,
  };
}

function toGame(
  game: GameCardRecord & { comments?: GameDetailRecord["comments"] },
  similarGames: GameDTO[] = [],
  categoryCounts?: CategoryCounts,
  now = Date.now(),
): GameDTO {
  return {
    id: game.id,
    title: game.title,
    slug: game.slug,
    tagline: game.tagline,
    description: game.description,
    controlsGuide: game.controlsGuide,
    developerName: game.developerName,
    category: toCategory(game.category, categoryCounts?.get(game.categoryId) ?? 0),
    tags: game.tags.map(({ tag }) => ({ id: tag.id, name: tag.name, slug: tag.slug })),
    sourceType: game.sourceType,
    embedUrl: game.embedUrl,
    aspectRatio: game.aspectRatio,
    orientation: game.orientation,
    supportsMobile: game.supportsMobile,
    thumbnailUrl: game.thumbnailUrl,
    posterUrl: game.posterUrl,
    previewVideoUrl: game.previewVideoUrl,
    screenshots: Array.isArray(game.screenshots) ? game.screenshots.filter((item): item is string => typeof item === "string") : [],
    status: game.status,
    isFeatured: game.isFeatured,
    isTrending: game.isTrending,
    isNew: Boolean(game.publishedAt && now - game.publishedAt.getTime() < 1000 * 60 * 60 * 24 * 21),
    playCount: Number(game.playCount),
    likesCount: game.likesCount,
    dislikesCount: game.dislikesCount,
    publishedAt: game.publishedAt?.toISOString() || null,
    createdAt: game.createdAt.toISOString(),
    updatedAt: game.updatedAt.toISOString(),
    comments: (game.comments ?? []).map((comment) => ({
      id: comment.id,
      body: comment.body,
      createdAt: comment.createdAt.toISOString(),
      user: comment.user,
    })),
    similarGames,
  };
}

function mapGameCards(games: GameCardRecord[], categoryCounts: CategoryCounts, now = Date.now()): GameDTO[] {
  return games.map((game) => toGame(game, [], categoryCounts, now));
}

async function getCategoryCounts(): Promise<CategoryCounts> {
  const counts = await prisma.game.groupBy({
    by: ["categoryId"],
    where: { status: "PUBLISHED" },
    _count: { _all: true },
  });
  return new Map(counts.map((item) => [item.categoryId, item._count._all]));
}

function boundedInteger(value: number | undefined, fallback: number, min: number, max: number): number {
  return value !== undefined && Number.isFinite(value)
    ? Math.min(max, Math.max(min, Math.trunc(value)))
    : fallback;
}

function normalizeGameFilters(filters: GameFilters): GameFilters {
  return {
    categorySlug: filters.categorySlug?.trim().slice(0, 120) || undefined,
    tagSlug: filters.tagSlug?.trim().slice(0, 100) || undefined,
    search: filters.search?.trim().slice(0, 120) || undefined,
    status: filters.status,
    limit: boundedInteger(filters.limit, 24, 1, 60),
    offset: boundedInteger(filters.offset, 0, 0, 100_000),
    featured: filters.featured,
    trending: filters.trending,
    sort: filters.sort || "popular",
  };
}

async function getCategoriesUncached(): Promise<CategoryDTO[]> {
  const [categories, counts] = await Promise.all([
    prisma.category.findMany({ orderBy: [{ displayOrder: "asc" }, { name: "asc" }] }),
    getCategoryCounts(),
  ]);

  return categories.map((category) => toCategory(category, counts.get(category.id) ?? 0));
}

export const getCategories = unstable_cache(getCategoriesUncached, ["categories"], catalogCache);

async function getTagsUncached(): Promise<TagDTO[]> {
  return prisma.tag.findMany({ orderBy: { name: "asc" } });
}

export const getTags = unstable_cache(getTagsUncached, ["tags"], catalogCache);

async function findGameCards(filters: GameFilters): Promise<GameCardRecord[]> {
  const where: Prisma.GameWhereInput = {
    status: filters.status || "PUBLISHED",
    ...(filters.categorySlug ? { category: { slug: filters.categorySlug } } : {}),
    ...(filters.tagSlug ? { tags: { some: { tag: { slug: filters.tagSlug } } } } : {}),
    ...(filters.featured !== undefined ? { isFeatured: filters.featured } : {}),
    ...(filters.trending !== undefined ? { isTrending: filters.trending } : {}),
    ...(filters.search
      ? {
          OR: [
            { title: { contains: filters.search } },
            { tagline: { contains: filters.search } },
            { description: { contains: filters.search } },
            { category: { name: { contains: filters.search } } },
            { tags: { some: { tag: { name: { contains: filters.search } } } } },
          ],
        }
      : {}),
  };

  const orderBy: Prisma.GameOrderByWithRelationInput[] =
    filters.sort === "newest"
      ? [{ publishedAt: "desc" }, { createdAt: "desc" }]
      : filters.sort === "updated"
        ? [{ updatedAt: "desc" }]
        : filters.sort === "rating"
          ? [{ likesCount: "desc" }, { playCount: "desc" }]
          : filters.sort === "title"
            ? [{ title: "asc" }]
            : [{ playCount: "desc" }, { publishedAt: "desc" }];

  return prisma.game.findMany({
    where,
    include: gameCardInclude,
    orderBy,
    take: filters.limit,
    skip: filters.offset,
  });
}

async function getGamesUncached(filters: GameFilters): Promise<GameDTO[]> {
  const [games, counts] = await Promise.all([findGameCards(filters), getCategoryCounts()]);
  return mapGameCards(games, counts);
}

const getPublishedGamesCached = unstable_cache(getGamesUncached, ["games"], catalogCache);

export async function getGames(filters: GameFilters = {}): Promise<GameDTO[]> {
  const normalized = normalizeGameFilters(filters);
  if (normalized.status && normalized.status !== "PUBLISHED") {
    return getGamesUncached(normalized);
  }
  return getPublishedGamesCached(normalized);
}

async function getGameBySlugUncached(slug: string, includeUnpublished: boolean): Promise<GameDTO | null> {
  const game = await prisma.game.findUnique({ where: { slug }, include: gameDetailInclude });
  if (!game || (!includeUnpublished && game.status !== "PUBLISHED")) return null;

  const [similar, counts] = await Promise.all([
    prisma.game.findMany({
      where: {
        status: "PUBLISHED",
        categoryId: game.categoryId,
        id: { not: game.id },
      },
      include: gameCardInclude,
      orderBy: [{ playCount: "desc" }, { publishedAt: "desc" }],
      take: 4,
    }),
    getCategoryCounts(),
  ]);
  const now = Date.now();
  return toGame(game, mapGameCards(similar, counts, now), counts, now);
}

const getPublishedGameBySlugCached = unstable_cache(
  (slug: string) => getGameBySlugUncached(slug, false),
  ["game-by-slug"],
  catalogCache,
);

export async function getGameBySlug(slug: string, includeUnpublished = false): Promise<GameDTO | null> {
  const normalized = slug.trim().slice(0, 220);
  if (!normalized) return null;
  return includeUnpublished
    ? getGameBySlugUncached(normalized, true)
    : getPublishedGameBySlugCached(normalized);
}

async function getHomeFeedUncached(): Promise<HomeFeed> {
  const [featuredRecords, trendingRecords, newRecords, categories, counts, ranked] = await Promise.all([
    findGameCards(normalizeGameFilters({ featured: true, sort: "popular", limit: 4 })),
    findGameCards(normalizeGameFilters({ trending: true, sort: "popular", limit: 12 })),
    findGameCards(normalizeGameFilters({ sort: "newest", limit: 12 })),
    prisma.category.findMany({ orderBy: [{ displayOrder: "asc" }, { name: "asc" }] }),
    getCategoryCounts(),
    prisma.$queryRaw<Array<{ id: number | bigint; categoryId: number | bigint; rowNumber: bigint }>>`
      SELECT id, categoryId, rowNumber FROM (
        SELECT g.id, g.categoryId,
          ROW_NUMBER() OVER (
            PARTITION BY g.categoryId
            ORDER BY g.playCount DESC, g.publishedAt DESC, g.id DESC
          ) AS rowNumber
        FROM Game AS g
        WHERE g.status = 'PUBLISHED'
      ) AS rankedGames
      WHERE rowNumber <= 12
      ORDER BY categoryId, rowNumber
    `,
  ]);

  const rankedIds = ranked.map((row) => Number(row.id));
  const rankedGames = rankedIds.length
    ? await prisma.game.findMany({ where: { id: { in: rankedIds } }, include: gameCardInclude })
    : [];
  const gamesById = new Map(rankedGames.map((game) => [game.id, toGame(game, [], counts)]));
  const now = Date.now();
  const featured = mapGameCards(featuredRecords, counts, now);
  const trending = mapGameCards(trendingRecords, counts, now);

  const categoryRows = categories.flatMap((category) => {
    const games = ranked
      .filter((row) => Number(row.categoryId) === category.id)
      .sort((a, b) => Number(a.rowNumber - b.rowNumber))
      .map((row) => gamesById.get(Number(row.id)))
      .filter((game): game is GameDTO => Boolean(game));
    return games.length ? [{ category: toCategory(category, counts.get(category.id) ?? 0), games }] : [];
  });

  return {
    featured: featured.length ? featured : trending.slice(0, 3),
    trending,
    newReleases: mapGameCards(newRecords, counts, now),
    categoryRows,
  };
}

export const getHomeFeed = unstable_cache(getHomeFeedUncached, ["home-feed"], catalogCache);

async function getGamesByIdsUncached(ids: number[]): Promise<GameDTO[]> {
  if (!ids.length) return [];
  const [games, counts] = await Promise.all([
    prisma.game.findMany({ where: { id: { in: ids }, status: "PUBLISHED" }, include: gameCardInclude }),
    getCategoryCounts(),
  ]);
  const byId = new Map(games.map((game) => [game.id, toGame(game, [], counts)]));
  return ids.map((id) => byId.get(id)).filter((game): game is GameDTO => Boolean(game));
}

const getPublishedGamesByIdsCached = unstable_cache(getGamesByIdsUncached, ["games-by-ids"], catalogCache);

export async function getGamesByIds(ids: number[]): Promise<GameDTO[]> {
  const normalized = [...new Set(ids.filter((id) => Number.isSafeInteger(id) && id > 0))].slice(0, MAX_LIBRARY_GAMES);
  return normalized.length ? getPublishedGamesByIdsCached(normalized) : [];
}

export async function getUserLibrary(userId: number) {
  const [favorites, history] = await Promise.all([
    prisma.userFavorite.findMany({
      where: { userId },
      orderBy: [{ createdAt: "desc" }],
      take: MAX_LIBRARY_GAMES,
      select: { gameId: true },
    }),
    prisma.playHistory.findMany({
      where: { userId },
      orderBy: { playedAt: "desc" },
      take: 60,
      select: { gameId: true, playedAt: true },
    }),
  ]);

  const favoriteIds = favorites.map((item) => item.gameId);
  const recentIds = [...new Set(history.map((item) => item.gameId))];
  const [favoriteGames, recentGames] = await Promise.all([
    getGamesByIds(favoriteIds),
    getGamesByIds(recentIds),
  ]);
  const latestPlayedAt = new Map(history.map((item) => [item.gameId, item.playedAt.toISOString()]));

  return {
    favorites: favoriteGames,
    playHistory: recentGames.map((game) => ({
      game,
      playedAt: latestPlayedAt.get(game.id) || null,
    })),
  };
}

export async function getAdminStats(): Promise<AdminStats> {
  const [totalGames, publishedGames, draftGames, playAggregate, totalUsers, topRecords, counts] = await Promise.all([
    prisma.game.count(),
    prisma.game.count({ where: { status: "PUBLISHED" } }),
    prisma.game.count({ where: { status: "DRAFT" } }),
    prisma.game.aggregate({ _sum: { playCount: true } }),
    prisma.user.count(),
    prisma.game.findMany({ include: gameCardInclude, orderBy: [{ playCount: "desc" }], take: 10 }),
    getCategoryCounts(),
  ]);

  return {
    totalGames,
    publishedGames,
    draftGames,
    totalPlays: Number(playAggregate._sum.playCount || 0n),
    totalUsers,
    topGames: mapGameCards(topRecords, counts),
  };
}

export async function getAdminGames(filters: GameFilters = {}): Promise<GameDTO[]> {
  const where: Prisma.GameWhereInput = {
    ...(filters.status ? { status: filters.status as GameStatus } : {}),
    ...(filters.search
      ? {
          OR: [
            { title: { contains: filters.search } },
            { slug: { contains: filters.search } },
            { developerName: { contains: filters.search } },
          ],
        }
      : {}),
  };

  const [games, counts] = await Promise.all([
    prisma.game.findMany({
      where,
      include: gameCardInclude,
      orderBy: [{ updatedAt: "desc" }],
      take: boundedInteger(filters.limit, 100, 1, 200),
      skip: boundedInteger(filters.offset, 0, 0, 100_000),
    }),
    getCategoryCounts(),
  ]);
  return mapGameCards(games, counts);
}

export async function getGameById(id: number, includeUnpublished = true): Promise<GameDTO | null> {
  const [game, counts] = await Promise.all([
    prisma.game.findUnique({ where: { id }, include: gameCardInclude }),
    getCategoryCounts(),
  ]);
  if (!game || (!includeUnpublished && game.status !== "PUBLISHED")) return null;
  return toGame(game, [], counts);
}

export function toComment(comment: {
  id: number;
  body: string;
  createdAt: Date;
  user: PublicUser;
}): CommentDTO {
  return { id: comment.id, body: comment.body, createdAt: comment.createdAt.toISOString(), user: comment.user };
}
