import { createHash } from "node:crypto";
import { rm } from "node:fs/promises";
import { resolve, sep } from "node:path";
import bcrypt from "bcryptjs";
import { GraphQLError } from "graphql";
import type { NextRequest } from "next/server";
import { revalidateTag } from "next/cache";
import { clearSession, setSession } from "@/lib/auth";
import {
  clearCatalogLru,
  getAdminGames,
  getAdminStats,
  getCategories,
  getFollowers,
  getFollowing,
  getGameById,
  getGameBySlug,
  getGames,
  getGamesByIds,
  getHomeFeed,
  getLeaderboard,
  getNetworkRecommendations,
  getTags,
  getUserLibrary,
  toComment,
} from "@/lib/data";
import { leaderboard } from "@/lib/leaderboard";
import { prisma } from "@/lib/prisma";
import { checkRateLimit, getClientKey } from "@/lib/rate-limit";
import type { SessionUser } from "@/lib/types";
import { categorySchema, gameInputSchema, loginSchema, registerSchema, tagSchema } from "@/lib/validation";
import { withGamePublishLock } from "@/lib/zip";

export interface GraphQLContext {
  request: NextRequest;
  user: SessionUser | null;
}

function fail(message: string, code = "BAD_USER_INPUT"): never {
  throw new GraphQLError(message, { extensions: { code } });
}

function authUser(context: GraphQLContext): SessionUser {
  if (!context.user) {
    throw new GraphQLError("Please sign in to continue.", { extensions: { code: "UNAUTHENTICATED" } });
  }
  return context.user;
}

function authAdmin(context: GraphQLContext): SessionUser {
  if (!context.user) {
    throw new GraphQLError("Please sign in to continue.", { extensions: { code: "UNAUTHENTICATED" } });
  }
  if (context.user.role !== "ADMIN") {
    throw new GraphQLError("Administrator access required.", { extensions: { code: "FORBIDDEN" } });
  }
  return context.user;
}

function invalidateCatalog() {
  clearCatalogLru();
  revalidateTag("catalog", "max");
}

function parseId(value: unknown) {
  const id = Number(value);
  if (!Number.isSafeInteger(id) || id <= 0) fail("Invalid identifier.");
  return id;
}

function parseInput<T>(schema: { safeParse: (value: unknown) => { success: true; data: T } | { success: false; error: { issues: { message: string }[] } } }, value: unknown): T {
  const result = schema.safeParse(value);
  if (!result.success) fail(result.error.issues[0]?.message || "Invalid input.");
  return result.data;
}

async function enforceRateLimit(
  request: NextRequest,
  scope: string,
  limit: number,
  windowMs: number,
  subject?: string,
  includeUserAgent = false,
) {
  const result = await checkRateLimit(
    getClientKey(request, scope, subject, includeUserAgent),
    limit,
    windowMs,
  );
  if (!result.allowed) {
    throw new GraphQLError(`Too many requests. Try again in ${result.retryAfter} seconds.`, {
      extensions: {
        code: "RATE_LIMITED",
        retryAfter: result.retryAfter,
        http: { status: 429, headers: { "Retry-After": String(result.retryAfter) } },
      },
    });
  }
}

export const resolvers = {
  Query: {
    me: (_parent: unknown, _args: unknown, context: GraphQLContext) => context.user,
    homeFeed: () => getHomeFeed(),
    games: (_parent: unknown, args: Record<string, unknown>) =>
      getGames({
        categorySlug: args.categorySlug as string | undefined,
        tagSlug: args.tagSlug as string | undefined,
        search: args.search as string | undefined,
        status: "PUBLISHED",
        featured: args.featured as boolean | undefined,
        trending: args.trending as boolean | undefined,
        sort: args.sort as "popular" | "newest" | "updated" | "rating" | "title" | undefined,
        limit: args.limit as number | undefined,
        offset: args.offset as number | undefined,
      }),
    gameBySlug: (_parent: unknown, args: { slug: string }) => getGameBySlug(args.slug),
    gamesByIds: (_parent: unknown, args: { ids: unknown[] }) =>
      getGamesByIds([...new Set(args.ids.slice(0, 200).map(parseId))]),
    gameById: async (_parent: unknown, args: { id: string }, context: GraphQLContext) => {
      authAdmin(context);
      return getGameById(parseId(args.id));
    },
    categories: () => getCategories(),
    tags: () => getTags(),
    myFavorites: async (_parent: unknown, _args: unknown, context: GraphQLContext) =>
      (await getUserLibrary(authUser(context).id)).favorites,
    myPlayHistory: async (_parent: unknown, _args: unknown, context: GraphQLContext) =>
      (await getUserLibrary(authUser(context).id)).playHistory,
    myLibrary: async (_parent: unknown, _args: unknown, context: GraphQLContext) =>
      getUserLibrary(authUser(context).id),
    myFollowing: async (_parent: unknown, _args: unknown, context: GraphQLContext) =>
      getFollowing(authUser(context).id),
    myFollowers: async (_parent: unknown, _args: unknown, context: GraphQLContext) =>
      getFollowers(authUser(context).id),
    networkRecommendations: async (_parent: unknown, args: { limit?: number }, context: GraphQLContext) =>
      getNetworkRecommendations(authUser(context).id, args.limit ?? 8),
    leaderboard: async (_parent: unknown, args: { gameId: string; limit?: number }) =>
      getLeaderboard(parseId(args.gameId), args.limit ?? 10),
    adminStats: async (_parent: unknown, _args: unknown, context: GraphQLContext) => {
      authAdmin(context);
      return getAdminStats();
    },
    adminGames: async (_parent: unknown, args: Record<string, unknown>, context: GraphQLContext) => {
      authAdmin(context);
      return getAdminGames({
        search: args.search as string | undefined,
        status: args.status as "DRAFT" | "PUBLISHED" | "ARCHIVED" | undefined,
        limit: args.limit as number | undefined,
        offset: args.offset as number | undefined,
      });
    },
  },
  Mutation: {
    register: async (_parent: unknown, args: Record<string, unknown>, context: GraphQLContext) => {
      await enforceRateLimit(context.request, "auth:register", 5, 15 * 60 * 1000);
      const input = parseInput(registerSchema, args);
      const existing = await prisma.user.findFirst({
        where: { OR: [{ email: input.email }, { username: input.username }] },
        select: { id: true },
      });
      if (existing) fail("That username or email is already registered.", "CONFLICT");

      const user = await prisma.user.create({
        data: {
          username: input.username,
          email: input.email,
          passwordHash: await bcrypt.hash(input.password, 12),
        },
        select: { id: true, username: true, email: true, avatarUrl: true, role: true },
      });
      await setSession(user);
      return user;
    },
    login: async (_parent: unknown, args: Record<string, unknown>, context: GraphQLContext) => {
      await enforceRateLimit(context.request, "auth:login", 10, 15 * 60 * 1000);
      const input = parseInput(loginSchema, args);
      const user = await prisma.user.findUnique({ where: { email: input.email } });
      if (!user?.isActive || !(await bcrypt.compare(input.password, user.passwordHash))) {
        fail("Email or password is incorrect.", "UNAUTHENTICATED");
      }
      const sessionUser = { id: user.id, username: user.username, email: user.email, avatarUrl: user.avatarUrl, role: user.role };
      await setSession(sessionUser);
      return sessionUser;
    },
    logout: async () => {
      await clearSession();
      return true;
    },
    recordPlay: async (_parent: unknown, args: { gameId: string }, context: GraphQLContext) => {
      const fingerprint = context.user
        ? null
        : createHash("sha256")
            .update(`${getClientKey(context.request, "guest", undefined, true)}:${context.request.headers.get("user-agent") || "unknown"}`)
            .digest("hex")
            .slice(0, 128);
      await enforceRateLimit(
        context.request,
        "play",
        60,
        60 * 1000,
        context.user ? `user:${context.user.id}` : `guest:${fingerprint}`,
      );

      const gameId = parseId(args.gameId);
      const game = await prisma.game.findUnique({ where: { id: gameId }, select: { status: true } });
      if (!game || game.status !== "PUBLISHED") fail("Game not found.", "NOT_FOUND");

      await prisma.playHistory.create({
        data: { gameId, userId: context.user?.id, sessionFingerprint: fingerprint, countedAt: null },
      });
      return true;
    },
    toggleFavorite: async (_parent: unknown, args: { gameId: string }, context: GraphQLContext) => {
      const user = authUser(context);
      const gameId = parseId(args.gameId);
      const game = await prisma.game.findUnique({ where: { id: gameId }, select: { id: true } });
      if (!game) fail("Game not found.", "NOT_FOUND");

      const existing = await prisma.userFavorite.findUnique({
        where: { userId_gameId: { userId: user.id, gameId } },
      });
      if (existing) {
        await prisma.userFavorite.delete({ where: { userId_gameId: { userId: user.id, gameId } } });
        return false;
      }
      await prisma.userFavorite.create({ data: { userId: user.id, gameId } });
      return true;
    },
    voteGame: async (_parent: unknown, args: { gameId: string; vote: "LIKE" | "DISLIKE" }, context: GraphQLContext) => {
      const user = authUser(context);
      const gameId = parseId(args.gameId);
      const existing = await prisma.gameRating.findUnique({
        where: { userId_gameId: { userId: user.id, gameId } },
      });
      const game = await prisma.game.findUnique({ where: { id: gameId }, select: { id: true } });
      if (!game) fail("Game not found.", "NOT_FOUND");

      let likes = 0;
      let dislikes = 0;
      if (existing?.vote === args.vote) {
        await prisma.gameRating.delete({ where: { userId_gameId: { userId: user.id, gameId } } });
        if (args.vote === "LIKE") likes = -1;
        else dislikes = -1;
      } else {
        await prisma.gameRating.upsert({
          where: { userId_gameId: { userId: user.id, gameId } },
          update: { vote: args.vote },
          create: { userId: user.id, gameId, vote: args.vote },
        });
        if (args.vote === "LIKE") {
          likes = 1;
          if (existing?.vote === "DISLIKE") dislikes = -1;
        } else {
          dislikes = 1;
          if (existing?.vote === "LIKE") likes = -1;
        }
      }

      await prisma.game.update({
        where: { id: gameId },
        data: {
          likesCount: { increment: likes },
          dislikesCount: { increment: dislikes },
        },
      });
      invalidateCatalog();
      return getGameById(gameId, false);
    },
    addComment: async (_parent: unknown, args: { gameId: string; body: string }, context: GraphQLContext) => {
      const user = authUser(context);
      await enforceRateLimit(context.request, "comment", 10, 10 * 60 * 1000, `user:${user.id}`);
      const gameId = parseId(args.gameId);
      const body = args.body.trim();
      if (!body || body.length > 1000) fail("Comments must be between 1 and 1,000 characters.");
      const game = await prisma.game.findUnique({ where: { id: gameId }, select: { status: true } });
      if (!game || game.status !== "PUBLISHED") fail("Game not found.", "NOT_FOUND");

      const comment = await prisma.comment.create({
        data: { gameId, userId: user.id, body },
        include: { user: { select: { id: true, username: true, avatarUrl: true, role: true } } },
      });
      invalidateCatalog();
      return toComment(comment);
    },
    submitScore: async (_parent: unknown, args: { gameId: string; score: number }, context: GraphQLContext) => {
      const user = authUser(context);
      const gameId = parseId(args.gameId);
      if (!Number.isSafeInteger(args.score) || args.score < 0 || args.score > 999_999_999) {
        fail("Score must be a whole number between 0 and 999,999,999.");
      }
      await enforceRateLimit(context.request, "score", 30, 60_000, `user:${user.id}`);
      const game = await prisma.game.findUnique({ where: { id: gameId }, select: { status: true } });
      if (!game || game.status !== "PUBLISHED") fail("Game not found.", "NOT_FOUND");

      await prisma.$queryRaw`
        INSERT INTO GameScore (gameId, userId, score, updatedAt)
        VALUES (${gameId}, ${user.id}, ${args.score}, CURRENT_TIMESTAMP(0))
        ON DUPLICATE KEY UPDATE
          score = GREATEST(GameScore.score, VALUES(score)),
          updatedAt = CURRENT_TIMESTAMP(0)
      `;
      const record = await prisma.gameScore.findUnique({
        where: { gameId_userId: { gameId, userId: user.id } },
        select: { gameId: true, userId: true, score: true, updatedAt: true },
      });
      if (!record) fail("The score could not be saved.", "INTERNAL_SERVER_ERROR");
      await leaderboard.record(gameId, user.id, record.score);
      return { ...record, updatedAt: record.updatedAt.toISOString() };
    },
    followUser: async (_parent: unknown, args: { userId: string }, context: GraphQLContext) => {
      const user = authUser(context);
      const followeeId = parseId(args.userId);
      if (followeeId === user.id) fail("You cannot follow yourself.");
      await enforceRateLimit(context.request, "follow", 60, 60_000, `user:${user.id}`);
      const followee = await prisma.user.findFirst({
        where: { id: followeeId, isActive: true },
        select: { id: true },
      });
      if (!followee) fail("Player not found.", "NOT_FOUND");
      await prisma.userFollow.upsert({
        where: { followerId_followeeId: { followerId: user.id, followeeId } },
        update: {},
        create: { followerId: user.id, followeeId },
      });
      return true;
    },
    unfollowUser: async (_parent: unknown, args: { userId: string }, context: GraphQLContext) => {
      const user = authUser(context);
      const followeeId = parseId(args.userId);
      await prisma.userFollow.deleteMany({ where: { followerId: user.id, followeeId } });
      return true;
    },
    syncGuestLibrary: async (
      _parent: unknown,
      args: { favoriteGameIds?: unknown[]; playedGameIds?: unknown[] },
      context: GraphQLContext,
    ) => {
      const user = authUser(context);
      const favoriteIds = [...new Set((args.favoriteGameIds || []).slice(0, 200).map(parseId))];
      const playedIds = [...new Set((args.playedGameIds || []).map(parseId))].slice(0, 60);
      const games = await prisma.game.findMany({
        where: { id: { in: [...favoriteIds, ...playedIds] }, status: "PUBLISHED" },
        select: { id: true },
      });
      const validIds = new Set(games.map((game) => game.id));

      await prisma.$transaction([
        prisma.userFavorite.createMany({
          data: favoriteIds.filter((id) => validIds.has(id)).map((gameId) => ({ userId: user.id, gameId })),
          skipDuplicates: true,
        }),
        prisma.playHistory.createMany({
          data: playedIds.filter((id) => validIds.has(id)).map((gameId) => ({
            userId: user.id,
            gameId,
            countedAt: new Date(),
          })),
        }),
      ]);
      return true;
    },
    createGame: async (_parent: unknown, args: { input: unknown }, context: GraphQLContext) => {
      const user = authAdmin(context);
      const input = parseInput(gameInputSchema, args.input);
      const { tagIds, ...data } = input;
      const category = await prisma.category.findUnique({ where: { id: input.categoryId }, select: { id: true } });
      if (!category) fail("Choose a valid category.");
      if (tagIds.length) {
        const count = await prisma.tag.count({ where: { id: { in: tagIds } } });
        if (count !== tagIds.length) fail("One or more selected tags do not exist.");
      }

      try {
        const game = await prisma.game.create({
          data: {
            ...data,
            createdById: user.id,
            publishedAt: data.status === "PUBLISHED" ? new Date() : null,
            tags: { create: tagIds.map((tagId) => ({ tagId })) },
          },
        });
        invalidateCatalog();
        return getGameById(game.id);
      } catch (error) {
        if (error instanceof Error && "code" in error && error.code === "P2002") fail("A game with that slug already exists.", "CONFLICT");
        throw error;
      }
    },
    updateGame: async (_parent: unknown, args: { id: string; input: unknown }, context: GraphQLContext) => {
      authAdmin(context);
      const id = parseId(args.id);
      const input = parseInput(gameInputSchema, args.input);
      const { tagIds, ...data } = input;
      const existing = await prisma.game.findUnique({ where: { id }, select: { status: true, publishedAt: true } });
      if (!existing) fail("Game not found.", "NOT_FOUND");
      const category = await prisma.category.findUnique({ where: { id: input.categoryId }, select: { id: true } });
      if (!category) fail("Choose a valid category.");
      if (tagIds.length) {
        const count = await prisma.tag.count({ where: { id: { in: tagIds } } });
        if (count !== tagIds.length) fail("One or more selected tags do not exist.");
      }

      try {
        await prisma.game.update({
          where: { id },
          data: {
            ...data,
            publishedAt: data.status === "PUBLISHED" ? existing.publishedAt || new Date() : existing.publishedAt,
            tags: {
              deleteMany: {},
              create: tagIds.map((tagId) => ({ tagId })),
            },
          },
        });
        invalidateCatalog();
        return getGameById(id);
      } catch (error) {
        if (error instanceof Error && "code" in error && error.code === "P2002") fail("A game with that slug already exists.", "CONFLICT");
        throw error;
      }
    },
    deleteGame: async (_parent: unknown, args: { id: string }, context: GraphQLContext) => {
      authAdmin(context);
      const id = parseId(args.id);
      const game = await prisma.game.findUnique({ where: { id } });
      if (!game) fail("Game not found.", "NOT_FOUND");
      const match = game.sourceType === "UPLOADED_ZIP"
        ? game.embedUrl.match(/^\/uploads\/games\/([a-z0-9-]+)\/index\.html$/)
        : null;

      if (match) {
        await withGamePublishLock(match[1], async () => {
          await prisma.game.delete({ where: { id } });
          const root = resolve(process.cwd(), "public/uploads/games");
          const target = resolve(root, match[1]);
          const sharedBuild = await prisma.game.count({ where: { embedUrl: game.embedUrl } });
          if (sharedBuild === 0 && target.startsWith(root + sep)) {
            await rm(target, { recursive: true, force: true });
          }
        });
      } else {
        await prisma.game.delete({ where: { id } });
      }
      invalidateCatalog();
      return true;
    },
    createCategory: async (_parent: unknown, args: Record<string, unknown>, context: GraphQLContext) => {
      authAdmin(context);
      const input = parseInput(categorySchema, args);
      try {
        const category = await prisma.category.create({ data: input });
        invalidateCatalog();
        return { ...category, gameCount: 0 };
      } catch (error) {
        if (error instanceof Error && "code" in error && error.code === "P2002") fail("A category with that name or slug already exists.", "CONFLICT");
        throw error;
      }
    },
    updateCategory: async (_parent: unknown, args: Record<string, unknown>, context: GraphQLContext) => {
      authAdmin(context);
      const id = parseId(args.id);
      const input = parseInput(categorySchema, args);
      try {
        const category = await prisma.category.update({ where: { id }, data: input });
        const gameCount = await prisma.game.count({ where: { categoryId: id, status: "PUBLISHED" } });
        invalidateCatalog();
        return { ...category, gameCount };
      } catch (error) {
        if (error instanceof Error && "code" in error && error.code === "P2002") fail("A category with that name or slug already exists.", "CONFLICT");
        if (error instanceof Error && "code" in error && error.code === "P2025") fail("Category not found.", "NOT_FOUND");
        throw error;
      }
    },
    deleteCategory: async (_parent: unknown, args: { id: string }, context: GraphQLContext) => {
      authAdmin(context);
      const id = parseId(args.id);
      const count = await prisma.game.count({ where: { categoryId: id } });
      if (count > 0) fail("Move or delete the games in this category first.", "CONFLICT");
      try {
        await prisma.category.delete({ where: { id } });
        invalidateCatalog();
      } catch (error) {
        if (error instanceof Error && "code" in error && error.code === "P2025") fail("Category not found.", "NOT_FOUND");
        throw error;
      }
      return true;
    },
    createTag: async (_parent: unknown, args: Record<string, unknown>, context: GraphQLContext) => {
      authAdmin(context);
      const input = parseInput(tagSchema, args);
      try {
        const tag = await prisma.tag.create({ data: input });
        invalidateCatalog();
        return tag;
      } catch (error) {
        if (error instanceof Error && "code" in error && error.code === "P2002") fail("A tag with that name or slug already exists.", "CONFLICT");
        throw error;
      }
    },
    updateTag: async (_parent: unknown, args: Record<string, unknown>, context: GraphQLContext) => {
      authAdmin(context);
      const id = parseId(args.id);
      const input = parseInput(tagSchema, args);
      try {
        const tag = await prisma.tag.update({ where: { id }, data: input });
        invalidateCatalog();
        return tag;
      } catch (error) {
        if (error instanceof Error && "code" in error && error.code === "P2002") fail("A tag with that name or slug already exists.", "CONFLICT");
        if (error instanceof Error && "code" in error && error.code === "P2025") fail("Tag not found.", "NOT_FOUND");
        throw error;
      }
    },
    deleteTag: async (_parent: unknown, args: { id: string }, context: GraphQLContext) => {
      authAdmin(context);
      const id = parseId(args.id);
      try {
        await prisma.tag.delete({ where: { id } });
        invalidateCatalog();
      } catch (error) {
        if (error instanceof Error && "code" in error && error.code === "P2025") fail("Tag not found.", "NOT_FOUND");
        throw error;
      }
      return true;
    },
  },
};
