import type { GraphQLError } from "graphql";
import { createGraphQLError, createSchema, createYoga } from "graphql-yoga";
import type { NextRequest } from "next/server";
import { getCurrentUser } from "@/lib/auth";
import { resolvers } from "@/lib/graphql/resolvers";
import { typeDefs } from "@/lib/graphql/schema";

const schema = createSchema({ typeDefs, resolvers });

function isGraphQLErrorShape(error: unknown): error is GraphQLError {
  return typeof error === "object" && error !== null &&
    "name" in error && error.name === "GraphQLError" &&
    "message" in error && "extensions" in error &&
    ("path" in error || "locations" in error || "nodes" in error || "positions" in error);
}

function isAuthErrorShape(error: unknown): error is Error & { status?: unknown } {
  return typeof error === "object" && error !== null &&
    "name" in error && error.name === "AuthError";
}

function getErrorOrigin(error: unknown): unknown {
  const seen = new Set<unknown>();
  let current = error;
  while (typeof current === "object" && current !== null && "originalError" in current &&
    current.originalError != null && !seen.has(current)) {
    seen.add(current);
    current = current.originalError;
  }
  return current;
}

function maskGraphQLError(error: unknown, message: string) {
  const graphqlError = isGraphQLErrorShape(error) ? error : null;
  const originalError = getErrorOrigin(error);

  if (isAuthErrorShape(originalError)) {
    const forbidden = originalError.status === 403;
    return createGraphQLError(forbidden ? "Administrator access required." : "Please sign in to continue.", {
      extensions: { code: forbidden ? "FORBIDDEN" : "UNAUTHENTICATED" },
    });
  }

  if (!graphqlError || !isGraphQLErrorShape(originalError) || originalError.originalError != null ||
    originalError.extensions.unexpected === true || originalError.extensions.code === "INTERNAL_SERVER_ERROR") {
    return createGraphQLError(message, {
      extensions: { code: "INTERNAL_SERVER_ERROR", unexpected: true },
    });
  }

  const extensions: Record<string, unknown> = {};
  if (typeof originalError.extensions.code === "string") extensions.code = originalError.extensions.code;
  if (originalError.extensions.http && typeof originalError.extensions.http === "object") {
    extensions.http = originalError.extensions.http;
  }

  return createGraphQLError(graphqlError.message, {
    nodes: graphqlError.nodes,
    source: graphqlError.source,
    positions: graphqlError.positions,
    path: graphqlError.path,
    extensions,
  });
}

const yoga = createYoga({
  schema,
  graphiql: process.env.NODE_ENV !== "production",
  maskedErrors: {
    maskError: maskGraphQLError,
  },
  context: async ({ request }) => ({
    request: request as NextRequest,
    user: await getCurrentUser(),
  }),
});

export const runtime = "nodejs";
export const maxDuration = 60;

async function handleGraphQL(request: Request) {
  try {
    return await yoga.handle(request, {});
  } catch {
    return Response.json({ errors: [{ message: "The server could not complete that request." }] }, { status: 500 });
  }
}

export { handleGraphQL as GET, handleGraphQL as POST };
