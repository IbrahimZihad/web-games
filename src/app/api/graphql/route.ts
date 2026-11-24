import { GraphQLError } from "graphql";
import { createSchema, createYoga } from "graphql-yoga";
import type { NextRequest } from "next/server";
import { AuthError, getCurrentUser } from "@/lib/auth";
import { resolvers } from "@/lib/graphql/resolvers";
import { typeDefs } from "@/lib/graphql/schema";

const schema = createSchema({ typeDefs, resolvers });

function maskGraphQLError(error: unknown, message: string) {
  const originalError = error instanceof GraphQLError ? error.originalError : error;
  if (originalError instanceof AuthError || (originalError instanceof Error && originalError.name === "AuthError")) {
    const status = originalError instanceof AuthError
      ? originalError.status
      : (originalError as Error & { status?: unknown }).status;
    const forbidden = status === 403;
    return new GraphQLError(forbidden ? "Administrator access required." : "Please sign in to continue.", {
      extensions: { code: forbidden ? "FORBIDDEN" : "UNAUTHENTICATED" },
    });
  }

  if (!(error instanceof GraphQLError) || error.originalError) {
    return new GraphQLError(message, {
      extensions: { code: "INTERNAL_SERVER_ERROR", unexpected: true },
    });
  }

  const extensions: Record<string, unknown> = {};
  if (typeof error.extensions.code === "string") extensions.code = error.extensions.code;
  if (typeof error.extensions.unexpected === "boolean") extensions.unexpected = error.extensions.unexpected;

  return new GraphQLError(error.message, {
    nodes: error.nodes,
    source: error.source,
    positions: error.positions,
    path: error.path,
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
