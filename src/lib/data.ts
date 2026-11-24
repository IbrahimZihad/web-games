import { Prisma } from "@prisma/client";
import { prisma } from "@/lib/prisma";
import type {
  AdminStats,
  CategoryDTO,
  CommentDTO,
  GameDTO,
  GameFilters,
  GameStatus,
  HomeFeed,
  SessionUser,
  TagDTO,
} from "@/lib/types";

const gameInclude = {
  category: {
    include: {
      _count: { select: { games: { where: { status: "PUBLISHED" as const } } } },
    },
  },
  tags: { include: { tag: true }, orderBy: { tag: { name: "asc" } } },
  comments: {
    where: { isHidden: false },
    orderBy: { createdAt: "desc" },
    include: {
      user: { select: { id: true, username: true, email: true, avatarUrl: true, role: true } },
    },
  },
} satisfies Prisma.GameInclude;

type GameRecord = Prisma.GameGetPayload<{ include: typeof gameInclude }>;

function toUser(user: GameRecord["comments"][number]["user"]): SessionUser {
  return {
    id: user.id,
    username: user.username,
    email: user.email,
    avatarUrl: user.avatarUrl,
    role: user.role,
  };
}

function toCategory(category: GameRecord["category"]): CategoryDTO {
  return {
    id: category.id,
    name: category.name,
    slug: category.slug,
    iconName: category.iconName,
    description: category.description,
    displayOrder: category.displayOrder,
    gameCount: category._count.games,
  };
}

function toGame(game: GameRecord, similarGames: GameDTO[] = []): GameDTO {
  return {
    id: game.id,
    title: game.title,
    slug: game.slug,
    tagline: game.tagline,
    description: game.description,
    controlsGuide: game.controlsGuide,
    developerName: game.developerName,
    category: toCategory(game.category),
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
    isNew: Boolean(game.publishedAt && Date.now() - game.publishedAt.getTime() < 1000 * 60 * 60 * 24 * 21),
    playCount: Number(game.playCount),
    likesCount: game.likesCount,
    dislikesCount: game.dislikesCount,
    publishedAt: game.publishedAt?.toISOString() || null,
    createdAt: game.createdAt.toISOString(),
    updatedAt: game.updatedAt.toISOString(),
    comments: game.comments.map((comment) => ({
      id: comment.id,
      body: comment.body,
      createdAt: comment.createdAt.toISOString(),
      user: toUser(comment.user),
    })),
    similarGames,
  };
}

export async function getCategories(): Promise<CategoryDTO[]> {
  const categories = await prisma.category.findMany({
    orderBy: [{ displayOrder: "asc" }, { name: "asc" }],
    include: { _count: { select: { games: { where: { status: "PUBLISHED" } } } } },
  });

  return categories.map((category) => ({
    id: category.id,
    name: category.name,
    slug: category.slug,
    iconName: category.iconName,
    description: category.description,
    displayOrder: category.displayOrder,
    gameCount: category._count.games,
  }));
}

export async function getTags(): Promise<TagDTO[]> {
  return prisma.tag.findMany({ orderBy: { name: "asc" } });
}

export async function getGames(filters: GameFilters = {}): Promise<GameDTO[]> {
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

  const games = await prisma.game.findMany({
    where,
    include: gameInclude,
    orderBy,
    take: Math.min(Math.max(filters.limit || 24, 1), 60),
    skip: Math.max(filters.offset || 0, 0),
  });

  return games.map((game) => toGame(game));
}

export async function getGameBySlug(slug: string, includeUnpublished = false): Promise<GameDTO | null> {
  const game = await prisma.game.findUnique({
    where: { slug },
    include: gameInclude,
  });

  if (!game || (!includeUnpublished && game.status !== "PUBLISHED")) return null;

  const similar = await prisma.game.findMany({
    where: {
      status: "PUBLISHED",
      categoryId: game.categoryId,
      id: { not: game.id },
    },
    include: gameInclude,
    orderBy: [{ playCount: "desc" }],
    take: 4,
  });

  return toGame(game, similar.map((item) => toGame(item)));
}

export async function getHomeFeed(): Promise<HomeFeed> {
  const [featured, trending, newReleases, categories] = await Promise.all([
    getGames({ featured: true, sort: "popular", limit: 4 }),
    getGames({ trending: true, sort: "popular", limit: 12 }),
    getGames({ sort: "newest", limit: 12 }),
    getCategories(),
  ]);

  const categoryRows = await Promise.all(
    categories.map(async (category) => ({
      category,
      games: (await getGames({ categorySlug: category.slug, sort: "popular", limit: 12 })).filter(
        (game) => game.category.slug === category.slug,
      ),
    })),
  );

  return {
    featured: featured.length ? featured : trending.slice(0, 3),
    trending,
    newReleases,
    categoryRows: categoryRows.filter((row) => row.games.length > 0),
  };
}

export async function getGamesByIds(ids: number[]): Promise<GameDTO[]> {
  if (!ids.length) return [];
  const games = await prisma.game.findMany({
    where: { id: { in: ids }, status: "PUBLISHED" },
    include: gameInclude,
  });
  const byId = new Map(games.map((game) => [game.id, toGame(game)]));
  return ids.map((id) => byId.get(id)).filter((game): game is GameDTO => Boolean(game));
}

export async function getUserLibrary(userId: number) {
  const [favorites, history] = await Promise.all([
    prisma.userFavorite.findMany({
      where: { userId },
      orderBy: { createdAt: "desc" },
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

  return {
    favorites: favoriteGames,
    playHistory: recentGames.map((game) => ({
      game,
      playedAt: history.find((item) => item.gameId === game.id)?.playedAt.toISOString() || null,
    })),
  };
}

export async function getAdminStats(): Promise<AdminStats> {
  const [totalGames, publishedGames, draftGames, playAggregate, totalUsers] = await Promise.all([
    prisma.game.count(),
    prisma.game.count({ where: { status: "PUBLISHED" } }),
    prisma.game.count({ where: { status: "DRAFT" } }),
    prisma.game.aggregate({ _sum: { playCount: true } }),
    prisma.user.count(),
  ]);

  const allStatusGames = await prisma.game.findMany({
    include: gameInclude,
    orderBy: [{ playCount: "desc" }],
    take: 10,
  });

  return {
    totalGames,
    publishedGames,
    draftGames,
    totalPlays: Number(playAggregate._sum.playCount || 0n),
    totalUsers,
    topGames: allStatusGames.map((game) => toGame(game)),
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

  const games = await prisma.game.findMany({
    where,
    include: gameInclude,
    orderBy: [{ updatedAt: "desc" }],
    take: Math.min(Math.max(filters.limit || 100, 1), 200),
    skip: Math.max(filters.offset || 0, 0),
  });

  return games.map((game) => toGame(game));
}

export async function getGameById(id: number, includeUnpublished = true): Promise<GameDTO | null> {
  const game = await prisma.game.findUnique({ where: { id }, include: gameInclude });
  if (!game || (!includeUnpublished && game.status !== "PUBLISHED")) return null;
  return toGame(game);
}

export function toComment(comment: {
  id: number;
  body: string;
  createdAt: Date;
  user: SessionUser;
}): CommentDTO {
  return { id: comment.id, body: comment.body, createdAt: comment.createdAt.toISOString(), user: comment.user };
}
