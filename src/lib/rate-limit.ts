import { createHash } from "node:crypto";
import Redis from "ioredis";
import { consumeTokenBucket, type TokenBucketState } from "@/lib/token-bucket";

export interface RateLimitResult {
  allowed: boolean;
  retryAfter: number;
}

const MAX_LOCAL_ENTRIES = 50_000;
const LOCAL_CLEANUP_INTERVAL_MS = 60_000;
const entries = new Map<string, TokenBucketState>();
let lastCleanupAt = 0;
let redis: Redis | null | undefined;
let redisConnection: Promise<Redis | null> | undefined;
let lastRedisErrorAt = 0;

const redisScript = `
  local clock = redis.call("TIME")
  local now = tonumber(clock[1]) * 1000 + math.floor(tonumber(clock[2]) / 1000)
  local stored = redis.call("HMGET", KEYS[1], "tokens", "updatedAt")
  local capacity = tonumber(ARGV[1])
  local refillPerMs = tonumber(ARGV[2])
  local tokens = capacity
  local updatedAt = now
  if stored[1] and stored[2] then
    tokens = math.min(capacity, tonumber(stored[1]) + math.max(0, now - tonumber(stored[2])) * refillPerMs)
  end
  updatedAt = now
  local allowed = 0
  local retryAfterMs = 0
  if tokens >= 1 then
    tokens = tokens - 1
    allowed = 1
  else
    retryAfterMs = math.max(1, math.ceil((1 - tokens) / refillPerMs))
  end
  redis.call("HSET", KEYS[1], "tokens", tokens, "updatedAt", updatedAt)
  redis.call("PEXPIRE", KEYS[1], ARGV[3])
  return { allowed, retryAfterMs }
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
    const refillDuration = entry.refillPerMs > 0 ? entry.capacity / entry.refillPerMs : 60_000;
    if (now - entry.updatedAt >= refillDuration || overflow > 0) {
      entries.delete(key);
      if (now - entry.updatedAt < refillDuration) overflow -= 1;
    }
  }
}

function checkLocalRateLimit(key: string, limit: number, windowMs: number): RateLimitResult {
  const now = Date.now();
  cleanupLocalEntries(now);
  const result = consumeTokenBucket(entries.get(key), limit, limit / windowMs, now);
  entries.set(key, result.state);
  return {
    allowed: result.allowed,
    retryAfter: Math.max(1, Math.ceil(result.retryAfterMs / 1000)),
  };
}

export async function checkRateLimit(key: string, limit: number, windowMs: number): Promise<RateLimitResult> {
  const capacity = Math.max(1, Math.trunc(limit));
  const duration = Math.max(1, Math.trunc(windowMs));
  const refillPerMs = capacity / duration;
  const client = await getRedis();
  if (!client) return checkLocalRateLimit(key, capacity, duration);

  try {
    const [allowed, retryAfterMs] = await client.eval(
      redisScript,
      1,
      `rate-limit:${key}:${capacity}:${Math.round(refillPerMs * 1_000_000)}`,
      capacity,
      refillPerMs,
      duration * 2,
    ) as [number, number];
    return {
      allowed: allowed === 1,
      retryAfter: allowed === 1 ? 0 : Math.max(1, Math.ceil(retryAfterMs / 1000)),
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
