import { GraphQLClientError, gameFragment, graphqlRequest } from "@/lib/client-graphql";
import type {
  AdminStats,
  CategoryDTO,
  GameDTO,
  GameStatus,
  SessionUser,
  TagDTO,
} from "@/lib/types";

export type AdminGame = Omit<GameDTO, "category" | "comments" | "similarGames"> & {
  category: CategoryDTO;
};

export type AdminStatsData = Omit<AdminStats, "topGames"> & {
  topGames: AdminGame[];
};

export type CategoryWriteResult = Omit<CategoryDTO, "gameCount">;

export interface UpsertGameInput {
  title: string;
  slug: string;
  tagline: string | null;
  description: string;
  controlsGuide: string | null;
  developerName: string;
  categoryId: number;
  tagIds: number[];
  sourceType: "UPLOADED_ZIP" | "EXTERNAL_URL";
  embedUrl: string;
  aspectRatio: "RATIO_16_9" | "RATIO_4_3" | "RATIO_9_16" | "RESPONSIVE";
  orientation: "LANDSCAPE" | "PORTRAIT" | "ANY";
  supportsMobile: boolean;
  thumbnailUrl: string;
  posterUrl: string | null;
  previewVideoUrl: string | null;
  screenshots: string[];
  status: GameStatus;
  isFeatured: boolean;
  isTrending: boolean;
}

export interface CategoryInput {
  name: string;
  slug: string;
  iconName: string;
  description: string | null;
  displayOrder: number;
}

export interface TagInput {
  name: string;
  slug: string;
}

const categoryFields = "id name slug iconName description displayOrder gameCount";
const categoryWriteFields = "id name slug iconName description displayOrder";
const tagFields = "id name slug";

// gameFragment is shared with the portal. These merged selections restore the
// category fields used by admin screens without changing the public fragment.
const adminGameSelection = gameFragment
  .replace("fragment GameFields", "fragment AdminGameFields")
  .replace(
    "category { id name slug iconName gameCount }",
    "category { id name slug iconName gameCount description displayOrder }",
  )
  .replace(
    "user { id username avatarUrl role }",
    "user { id username avatarUrl role email }",
  );

const meQuery = `
  query AdminMe {
    me { id username email avatarUrl role }
  }
`;

const adminStatsQuery = `
  query AdminStats {
    adminStats {
      totalGames publishedGames draftGames totalPlays totalUsers
      topGames { ...AdminGameFields }
    }
  }
  ${adminGameSelection}
`;

const adminGamesQuery = `
  query AdminGames($search: String, $status: GameStatus, $limit: Int, $offset: Int) {
    adminGames(search: $search, status: $status, limit: $limit, offset: $offset) {
      ...AdminGameFields
    }
  }
  ${adminGameSelection}
`;

const gameByIdQuery = `
  query AdminGameById($id: ID!) {
    gameById(id: $id) { ...AdminGameFields }
  }
  ${adminGameSelection}
`;

const categoriesQuery = `
  query AdminCategories {
    categories { ${categoryFields} }
  }
`;

const tagsQuery = `
  query AdminTags {
    tags { ${tagFields} }
  }
`;

const createGameMutation = `
  mutation AdminCreateGame($input: UpsertGameInput!) {
    createGame(input: $input) { ...AdminGameFields }
  }
  ${adminGameSelection}
`;

const updateGameMutation = `
  mutation AdminUpdateGame($id: ID!, $input: UpsertGameInput!) {
    updateGame(id: $id, input: $input) { ...AdminGameFields }
  }
  ${adminGameSelection}
`;

const deleteGameMutation = `
  mutation AdminDeleteGame($id: ID!) {
    deleteGame(id: $id)
  }
`;

const createCategoryMutation = `
  mutation AdminCreateCategory($name: String!, $slug: String!, $iconName: String!, $description: String, $displayOrder: Int) {
    createCategory(name: $name, slug: $slug, iconName: $iconName, description: $description, displayOrder: $displayOrder) {
      ${categoryWriteFields}
    }
  }
`;

const updateCategoryMutation = `
  mutation AdminUpdateCategory($id: ID!, $name: String!, $slug: String!, $iconName: String!, $description: String, $displayOrder: Int) {
    updateCategory(id: $id, name: $name, slug: $slug, iconName: $iconName, description: $description, displayOrder: $displayOrder) {
      ${categoryWriteFields}
    }
  }
`;

const deleteCategoryMutation = `
  mutation AdminDeleteCategory($id: ID!) {
    deleteCategory(id: $id)
  }
`;

const createTagMutation = `
  mutation AdminCreateTag($name: String!, $slug: String!) {
    createTag(name: $name, slug: $slug) { ${tagFields} }
  }
`;

const updateTagMutation = `
  mutation AdminUpdateTag($id: ID!, $name: String!, $slug: String!) {
    updateTag(id: $id, name: $name, slug: $slug) { ${tagFields} }
  }
`;

const deleteTagMutation = `
  mutation AdminDeleteTag($id: ID!) {
    deleteTag(id: $id)
  }
`;

type GraphQLPayload<T> = {
  data?: T;
  errors?: { message: string }[];
};

function normalizeGame(game: AdminGame): AdminGame {
  return {
    ...game,
    id: Number(game.id),
    category: { ...game.category, id: Number(game.category.id) },
    tags: game.tags.map((tag) => ({ ...tag, id: Number(tag.id) })),
  };
}

function normalizeCategory(category: CategoryDTO): CategoryDTO {
  return { ...category, id: Number(category.id) };
}

function normalizeCategoryWrite(category: CategoryWriteResult): CategoryWriteResult {
  return { ...category, id: Number(category.id) };
}

function normalizeTag(tag: TagDTO): TagDTO {
  return { ...tag, id: Number(tag.id) };
}

async function serverGraphqlRequest<T>(
  query: string,
  variables?: object,
): Promise<T> {
  const { cookies, headers } = await import("next/headers");
  const [cookieStore, headerStore] = await Promise.all([cookies(), headers()]);
  const forwardedHost = headerStore.get("x-forwarded-host")?.split(",")[0]?.trim();
  const host = forwardedHost || headerStore.get("host") || "localhost:3000";
  const forwardedProtocol = headerStore.get("x-forwarded-proto")?.split(",")[0]?.trim();
  const isLocal = host.startsWith("localhost") || host.startsWith("127.0.0.1");
  const protocol = forwardedProtocol || (isLocal ? "http" : "https");
  const cookieHeader = cookieStore.toString();

  const response = await fetch(`${protocol}://${host}/api/graphql`, {
    method: "POST",
    headers: {
      "Content-Type": "application/json",
      ...(cookieHeader ? { cookie: cookieHeader } : {}),
    },
    body: JSON.stringify({ query, variables }),
    cache: "no-store",
  });

  let payload: GraphQLPayload<T>;
  try {
    payload = (await response.json()) as GraphQLPayload<T>;
  } catch {
    throw new GraphQLClientError("The admin API returned an unreadable response.");
  }

  if (!response.ok || payload.errors?.length) {
    throw new GraphQLClientError(
      payload.errors?.[0]?.message || "The admin request could not be completed.",
    );
  }
  if (!payload.data) throw new GraphQLClientError("The admin API returned an empty response.");
  return payload.data;
}

async function adminRequest<T>(
  query: string,
  variables?: object,
): Promise<T> {
  if (typeof window === "undefined") return serverGraphqlRequest<T>(query, variables);
  return graphqlRequest<T>(query, variables);
}

export function getAdminErrorMessage(error: unknown): string {
  return error instanceof GraphQLClientError
    ? error.message
    : "The request could not be completed. Please try again.";
}

export async function getAdminMe(): Promise<SessionUser | null> {
  const data = await adminRequest<{ me: SessionUser | null }>(meQuery);
  return data.me ? { ...data.me, id: Number(data.me.id) } : null;
}

export async function getAdminStats(): Promise<AdminStatsData> {
  const data = await adminRequest<{ adminStats: AdminStatsData }>(adminStatsQuery);
  return { ...data.adminStats, topGames: data.adminStats.topGames.map(normalizeGame) };
}

export async function getAdminGames(
  search = "",
  status?: GameStatus,
): Promise<AdminGame[]> {
  const data = await adminRequest<{ adminGames: AdminGame[] }>(adminGamesQuery, {
    search: search.trim() || null,
    status: status || null,
    limit: 200,
    offset: 0,
  });
  return data.adminGames.map(normalizeGame);
}

export async function getAdminGame(id: string | number): Promise<AdminGame | null> {
  const data = await adminRequest<{ gameById: AdminGame | null }>(gameByIdQuery, {
    id: String(id),
  });
  return data.gameById ? normalizeGame(data.gameById) : null;
}

export async function getAdminCategories(): Promise<CategoryDTO[]> {
  const data = await adminRequest<{ categories: CategoryDTO[] }>(categoriesQuery);
  return data.categories.map(normalizeCategory);
}

export async function getAdminTags(): Promise<TagDTO[]> {
  const data = await adminRequest<{ tags: TagDTO[] }>(tagsQuery);
  return data.tags.map(normalizeTag);
}

export async function createAdminGame(input: UpsertGameInput): Promise<AdminGame> {
  const data = await adminRequest<{ createGame: AdminGame }>(createGameMutation, { input });
  return normalizeGame(data.createGame);
}

export async function updateAdminGame(
  id: string | number,
  input: UpsertGameInput,
): Promise<AdminGame> {
  const data = await adminRequest<{ updateGame: AdminGame }>(updateGameMutation, {
    id: String(id),
    input,
  });
  return normalizeGame(data.updateGame);
}

export async function deleteAdminGame(id: number): Promise<boolean> {
  const data = await adminRequest<{ deleteGame: boolean }>(deleteGameMutation, {
    id: String(id),
  });
  return data.deleteGame;
}

export async function createAdminCategory(input: CategoryInput): Promise<CategoryWriteResult> {
  const data = await adminRequest<{ createCategory: CategoryWriteResult }>(
    createCategoryMutation,
    input,
  );
  return normalizeCategoryWrite(data.createCategory);
}

export async function updateAdminCategory(
  id: number,
  input: CategoryInput,
): Promise<CategoryWriteResult> {
  const data = await adminRequest<{ updateCategory: CategoryWriteResult }>(
    updateCategoryMutation,
    { id: String(id), ...input },
  );
  return normalizeCategoryWrite(data.updateCategory);
}

export async function deleteAdminCategory(id: number): Promise<boolean> {
  const data = await adminRequest<{ deleteCategory: boolean }>(deleteCategoryMutation, {
    id: String(id),
  });
  return data.deleteCategory;
}

export async function createAdminTag(input: TagInput): Promise<TagDTO> {
  const data = await adminRequest<{ createTag: TagDTO }>(createTagMutation, input);
  return normalizeTag(data.createTag);
}

export async function updateAdminTag(id: number, input: TagInput): Promise<TagDTO> {
  const data = await adminRequest<{ updateTag: TagDTO }>(updateTagMutation, {
    id: String(id),
    ...input,
  });
  return normalizeTag(data.updateTag);
}

export async function deleteAdminTag(id: number): Promise<boolean> {
  const data = await adminRequest<{ deleteTag: boolean }>(deleteTagMutation, {
    id: String(id),
  });
  return data.deleteTag;
}

export function gameToInput(game: AdminGame): UpsertGameInput {
  return {
    title: game.title,
    slug: game.slug,
    tagline: game.tagline,
    description: game.description,
    controlsGuide: game.controlsGuide,
    developerName: game.developerName,
    categoryId: game.category.id,
    tagIds: game.tags.map((tag) => tag.id),
    sourceType: game.sourceType,
    embedUrl: game.embedUrl,
    aspectRatio: game.aspectRatio,
    orientation: game.orientation,
    supportsMobile: game.supportsMobile,
    thumbnailUrl: game.thumbnailUrl,
    posterUrl: game.posterUrl,
    previewVideoUrl: game.previewVideoUrl,
    screenshots: [...game.screenshots],
    status: game.status,
    isFeatured: game.isFeatured,
    isTrending: game.isTrending,
  };
}
