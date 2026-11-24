import type { GraphQLError } from "graphql";
import { createGraphQLError, createSchema, createYoga } from "graphql-yoga";
import type { NextRequest } from "next/server";
import { AuthError, getCurrentUser } from "@/lib/auth";
import { resolvers } from "@/lib/graphql/resolvers";
import { typeDefs } from "@/lib/graphql/schema";

const schema = createSchema({ typeDefs, resolvers });

function isGraphQLErrorShape(error: unknown): error is GraphQLError {
  return typeof error === "object" && error !== null &&
    "message" in error && "extensions" in error &&
    ("path" in error || "locations" in error || "nodes" in error || "positions" in error);
}

function maskGraphQLError(error: unknown, message: string) {
  const graphqlError = isGraphQLErrorShape(error) ? error : null;
  const originalError = graphqlError?.originalError ?? error;
  if (originalError instanceof AuthError || (originalError instanceof Error && originalError.name === "AuthError")) {
    const status = originalError instanceof AuthError
      ? originalError.status
      : (originalError as Error & { status?: unknown }).status;
    const forbidden = status === 403;
    return createGraphQLError(forbidden ? "Administrator access required." : "Please sign in to continue.", {
      extensions: { code: forbidden ? "FORBIDDEN" : "UNAUTHENTICATED" },
    });
  }

  if (!graphqlError || graphqlError.originalError) {
    return createGraphQLError(message, {
      extensions: { code: "INTERNAL_SERVER_ERROR", unexpected: true },
    });
  }

  const extensions: Record<string, unknown> = {};
  if (typeof graphqlError.extensions.code === "string") extensions.code = graphqlError.extensions.code;
  if (typeof graphqlError.extensions.unexpected === "boolean") extensions.unexpected = graphqlError.extensions.unexpected;

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
