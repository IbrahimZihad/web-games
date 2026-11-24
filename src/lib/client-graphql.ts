export class GraphQLClientError extends Error {
  constructor(message: string) {
    super(message);
    this.name = "GraphQLClientError";
  }
}

export async function graphqlRequest<T>(query: string, variables?: object): Promise<T> {
  const response = await fetch("/api/graphql", {
    method: "POST",
    headers: { "Content-Type": "application/json" },
    credentials: "same-origin",
    body: JSON.stringify({ query, variables }),
  });

  const payload = (await response.json()) as {
    data?: T;
    errors?: { message: string; extensions?: { code?: string } }[];
  };

  if (!response.ok || payload.errors?.length) {
    throw new GraphQLClientError(payload.errors?.[0]?.message || "The request could not be completed.");
  }

  if (!payload.data) throw new GraphQLClientError("The server returned an empty response.");
  return payload.data;
}

export const gameFragment = `
  fragment GameFields on Game {
    id title slug tagline description controlsGuide developerName
    category { id name slug iconName gameCount }
    tags { id name slug }
    sourceType embedUrl aspectRatio orientation supportsMobile
    thumbnailUrl posterUrl previewVideoUrl screenshots
    status isFeatured isTrending playCount likesCount dislikesCount
    publishedAt createdAt updatedAt comments { id body createdAt user { id username avatarUrl role } }
    similarGames { id title slug thumbnailUrl category { name } playCount likesCount }
  }
`;
