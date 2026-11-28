import { PrismaClient } from "@prisma/client";

const globalForPrisma = globalThis as unknown as {
  prisma: PrismaClient | undefined;
};

function envInteger(name: string, fallback: number, min: number, max: number): number {
  const value = Number(process.env[name]);
  return Number.isFinite(value) && value > 0 ? Math.min(max, Math.max(min, Math.trunc(value))) : fallback;
}

function databaseUrl(): string | undefined {
  if (!process.env.DATABASE_URL) return undefined;
  const url = new URL(process.env.DATABASE_URL);
  url.searchParams.set("connection_limit", String(envInteger("DATABASE_POOL_SIZE", 20, 1, 200)));
  url.searchParams.set("pool_timeout", String(envInteger("DATABASE_POOL_TIMEOUT_SECONDS", 10, 1, 120)));
  return url.toString();
}

export const prisma =
  globalForPrisma.prisma ??
  new PrismaClient({
    datasourceUrl: databaseUrl(),
    log: process.env.NODE_ENV === "development" ? ["warn", "error"] : ["error"],
  });

if (process.env.NODE_ENV !== "production") {
  globalForPrisma.prisma = prisma;
}
