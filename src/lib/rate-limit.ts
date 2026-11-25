import { createHash } from "node:crypto";
import Redis from "ioredis";

export interface RateLimitResult {
  allowed: boolean;
  retryAfter: number;
}

type RateEntry = {
  count: number;
  resetAt: number;
};

const MAX_LOCAL_ENTRIES = 50_000;
const LOCAL_CLEANUP_INTERVAL_MS = 60_000;
const entries = new Map<string, RateEntry>();
let lastCleanupAt = 0;
let redis: Redis | null | undefined;
let redisConnection: Promise<Redis | null> | undefined;
let lastRedisErrorAt = 0;

const redisScript = `
  local current = redis.call("INCR", KEYS[1])
  if current == 1 then
    redis.call("PEXPIRE", KEYS[1], ARGV[1])
  end
  local ttl = redis.call("PTTL", KEYS[1])
  return { current, ttl }
`;

function getRedis(): Promise<Redis | null> {
  if (!process.env.REDIS_URL) return Promise.resolve(null);
  if (redis === undefined) {
    redis = new Redis(process.env.REDIS_URL, {
      lazyConnect: true,
      enableOfflineQueue: false,
      maxRetriesPerRequest: 1,
      connectTimeout: 1_000,
    });
    redis.on("error", () => {
      const now = Date.now();
      if (now - lastRedisErrorAt > 60_000) {
        console.error("Rate-limit Redis connection error.");
        lastRedisErrorAt = now;
      }
    });
  }
  if (redisConnection) return redisConnection;
  const client = redis;
  if (!client) return Promise.resolve(null);

  const connection = client.connect().then(() => client).catch(() => {
    redis = undefined;
    redisConnection = undefined;
    return null;
  });
  redisConnection = connection;
  return connection;
}

function cleanupLocalEntries(now: number): void {
  if (entries.size < MAX_LOCAL_ENTRIES && now - lastCleanupAt < LOCAL_CLEANUP_INTERVAL_MS) return;
  lastCleanupAt = now;

  let overflow = Math.max(entries.size - MAX_LOCAL_ENTRIES, 0);
  for (const [key, entry] of entries) {
    if (entry.resetAt <= now || overflow > 0) {
      entries.delete(key);
      if (entry.resetAt > now) overflow -= 1;
    }
  }
}

function checkLocalRateLimit(key: string, limit: number, windowMs: number): RateLimitResult {
  const now = Date.now();
  cleanupLocalEntries(now);
  const current = entries.get(key);

  if (!current || current.resetAt <= now) {
    entries.set(key, { count: 1, resetAt: now + windowMs });
    return { allowed: true, retryAfter: 0 };
  }

  if (current.count >= limit) {
    return { allowed: false, retryAfter: Math.max(1, Math.ceil((current.resetAt - now) / 1000)) };
  }

  current.count += 1;
  return { allowed: true, retryAfter: 0 };
}

export async function checkRateLimit(key: string, limit: number, windowMs: number): Promise<RateLimitResult> {
  const client = await getRedis();
  if (!client) return checkLocalRateLimit(key, limit, windowMs);

  try {
    const [count, ttl] = await client.eval(redisScript, 1, `rate-limit:${key}`, windowMs) as [number, number];
    return {
      allowed: count <= limit,
      retryAfter: count <= limit ? 0 : Math.max(1, Math.ceil(ttl / 1000)),
    };
  } catch {
    return { allowed: false, retryAfter: 1 };
  }
}

export function getClientKey(
  request: Request,
  scope: string,
  subject?: string,
  includeUserAgent = false,
): string {
  let ip = "local";
  if (process.env.TRUST_PROXY === "true") {
    const forwarded = request.headers.get("x-forwarded-for")
      ?.split(",")
      .map((value) => value.trim())
      .filter(Boolean);
    ip = forwarded?.at(-1) || request.headers.get("x-real-ip")?.trim() || "local";
  }

  const identity = subject
    ? `subject:${subject}`
    : `ip:${ip}${includeUserAgent ? `:ua:${request.headers.get("user-agent") || "unknown"}` : ""}`;
  return `${scope}:${createHash("sha256").update(identity).digest("hex").slice(0, 40)}`;
}
