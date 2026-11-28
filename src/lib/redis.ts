import Redis from "ioredis";

export function createRedisClient(connectionName: string): Redis {
  const url = process.env.REDIS_URL;
  if (!url) throw new Error("REDIS_URL is required.");
  return new Redis(url, {
    connectionName,
    maxRetriesPerRequest: null,
    connectTimeout: 5_000,
    enableReadyCheck: true,
  });
}
