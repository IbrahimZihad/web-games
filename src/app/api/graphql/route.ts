import { createSchema, createYoga } from "graphql-yoga";
import type { NextRequest } from "next/server";
import { getCurrentUser } from "@/lib/auth";
import { resolvers } from "@/lib/graphql/resolvers";
import { typeDefs } from "@/lib/graphql/schema";

const schema = createSchema({ typeDefs, resolvers });

const yoga = createYoga({
  schema,
  graphiql: process.env.NODE_ENV !== "production",
  maskedErrors: true,
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
