import Redis from "ioredis";
import { createRedisClient } from "../../../src/lib/redis";

const ONLINE_ROOM = "nexus:presence:online";
const MEMBER_TTL_MS = 45_000;

const touchScript = `
  local now = tonumber(ARGV[1])
  local ttl = tonumber(ARGV[2])
  redis.call('ZREMRANGEBYSCORE', KEYS[1], '-inf', now - ttl)
  redis.call('ZADD', KEYS[1], now, ARGV[3])
  redis.call('EXPIRE', KEYS[1], 300)
  return redis.call('ZCARD', KEYS[1])
`;

const moveScript = `
  local now = tonumber(ARGV[1])
  local ttl = tonumber(ARGV[2])
  local id = ARGV[3]
  local function prune(key)
    redis.call('ZREMRANGEBYSCORE', key, '-inf', now - ttl)
    redis.call('EXPIRE', key, 300)
  end
  prune(KEYS[1])
  redis.call('ZADD', KEYS[1], now, id)
  local previousCount = 0
  if KEYS[2] ~= '' then
    prune(KEYS[2])
    redis.call('ZREM', KEYS[2], id)
    previousCount = redis.call('ZCARD', KEYS[2])
  end
  local nextCount = 0
  if KEYS[3] ~= '' then
    prune(KEYS[3])
    if KEYS[3] ~= KEYS[2] then redis.call('ZADD', KEYS[3], now, id) end
    nextCount = redis.call('ZCARD', KEYS[3])
  end
  return { redis.call('ZCARD', KEYS[1]), previousCount, nextCount }
`;

const leaveScript = `
  redis.call('ZREM', KEYS[1], ARGV[1])
  local gameCount = 0
  if KEYS[2] ~= '' then
    redis.call('ZREM', KEYS[2], ARGV[1])
    gameCount = redis.call('ZCARD', KEYS[2])
  end
  return { redis.call('ZCARD', KEYS[1]), gameCount }
`;

export interface PresenceMove {
  onlineCount: number;
  previousCount: number;
  count: number;
}

export interface PresenceLeave {
  onlineCount: number;
  gameCount: number;
}

export class PresenceStore {
  readonly mode: "redis" | "local";
  private readonly redis: Redis | null;
  private readonly localRooms = new Map<string, Map<string, number>>();
  private lastErrorAt = 0;

  constructor() {
    this.mode = process.env.REDIS_URL ? "redis" : "local";
    this.redis = this.mode === "redis" ? createRedisClient("nexus-presence") : null;
    this.redis?.on("error", () => {
      const now = Date.now();
      if (now - this.lastErrorAt > 60_000) {
        console.error("Presence Redis connection error; using local presence temporarily.");
        this.lastErrorAt = now;
      }
    });
  }

  private gameKey(gameId: number | null): string {
    return gameId === null ? "" : `nexus:presence:game:${gameId}`;
  }

  private localTouch(key: string, socketId: string): number {
    const now = Date.now();
    const members = this.localRooms.get(key) ?? new Map<string, number>();
    for (const [id, seenAt] of members) {
      if (now - seenAt > MEMBER_TTL_MS) members.delete(id);
    }
    members.set(socketId, now);
    this.localRooms.set(key, members);
    return members.size;
  }

  private localRemove(key: string, socketId: string): number {
    if (!key) return 0;
    const members = this.localRooms.get(key);
    if (!members) return 0;
    members.delete(socketId);
    if (!members.size) this.localRooms.delete(key);
    return members.size;
  }

  private reportFailure(error: unknown): void {
    const now = Date.now();
    if (now - this.lastErrorAt > 60_000) {
      console.error("Presence store operation failed; using local presence temporarily.", error);
      this.lastErrorAt = now;
    }
  }

  async connect(socketId: string): Promise<number> {
    if (!this.redis) return this.localTouch(ONLINE_ROOM, socketId);
    try {
      return await this.redis.eval(touchScript, 1, ONLINE_ROOM, Date.now(), MEMBER_TTL_MS, socketId) as number;
    } catch (error) {
      this.reportFailure(error);
      return this.localTouch(ONLINE_ROOM, socketId);
    }
  }

  async move(socketId: string, previousGameId: number | null, nextGameId: number | null): Promise<PresenceMove> {
    const previousKey = this.gameKey(previousGameId);
    const nextKey = this.gameKey(nextGameId);
    if (!this.redis) {
      return {
        onlineCount: this.localTouch(ONLINE_ROOM, socketId),
        previousCount: this.localRemove(previousKey, socketId),
        count: nextKey ? this.localTouch(nextKey, socketId) : 0,
      };
    }
    try {
      const [onlineCount, previousCount, count] = await this.redis.eval(
        moveScript,
        3,
        ONLINE_ROOM,
        previousKey,
        nextKey,
        Date.now(),
        MEMBER_TTL_MS,
        socketId,
      ) as [number, number, number];
      return { onlineCount, previousCount, count };
    } catch (error) {
      this.reportFailure(error);
      return {
        onlineCount: this.localTouch(ONLINE_ROOM, socketId),
        previousCount: this.localRemove(previousKey, socketId),
        count: nextKey ? this.localTouch(nextKey, socketId) : 0,
      };
    }
  }

  async leave(socketId: string, gameId: number | null): Promise<PresenceLeave> {
    const gameKey = this.gameKey(gameId);
    if (!this.redis) {
      return {
        onlineCount: this.localRemove(ONLINE_ROOM, socketId),
        gameCount: this.localRemove(gameKey, socketId),
      };
    }
    try {
      const [onlineCount, gameCount] = await this.redis.eval(
        leaveScript,
        2,
        ONLINE_ROOM,
        gameKey,
        socketId,
      ) as [number, number];
      return { onlineCount, gameCount };
    } catch (error) {
      this.reportFailure(error);
      return {
        onlineCount: this.localRemove(ONLINE_ROOM, socketId),
        gameCount: this.localRemove(gameKey, socketId),
      };
    }
  }

  async close(): Promise<void> {
    if (!this.redis) return;
    if (this.redis.status === "end") return;
    await this.redis.quit().catch(() => this.redis?.disconnect());
  }
}
