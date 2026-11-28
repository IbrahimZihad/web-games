import Redis from "ioredis";
import { prisma } from "@/lib/prisma";
import { SortedSet } from "@/lib/sorted-set";

const LOCAL_BOARD_LIMIT = 500;
const recordScript = `
  local current = redis.call('ZSCORE', KEYS[1], ARGV[1])
  if not current or tonumber(ARGV[2]) > tonumber(current) then
    redis.call('ZADD', KEYS[1], ARGV[2], ARGV[1])
  end
  return redis.call('ZSCORE', KEYS[1], ARGV[1])
`;

export interface LeaderboardMember {
  userId: number;
  score: number;
}

export class LeaderboardStore {
  readonly mode: "redis" | "local";
  private readonly redis: Redis | null;
  private readonly localBoards = new Map<number, SortedSet>();
  private connection: Promise<Redis | null> | undefined;
  private lastErrorAt = 0;

  constructor() {
    this.mode = process.env.REDIS_URL ? "redis" : "local";
    this.redis = this.mode === "redis" ? new Redis(process.env.REDIS_URL, {
      lazyConnect: true,
      enableOfflineQueue: false,
      maxRetriesPerRequest: 1,
      connectTimeout: 1_000,
    }) : null;
    this.redis?.on("error", () => this.reportFailure());
  }

  async record(gameId: number, userId: number, score: number): Promise<void> {
    const board = await this.localBoard(gameId);
    board.add(String(userId), score, true);
    const client = await this.getRedis();
    if (!client) return;
    try {
      await client.eval(recordScript, 1, this.key(gameId), String(userId), score);
    } catch {
      this.reportFailure();
    }
  }

  async topMembers(gameId: number, limit: number): Promise<LeaderboardMember[]> {
    const boundedLimit = Math.max(1, Math.min(50, Math.trunc(limit)));
    const client = await this.getRedis();
    if (client) {
      try {
        const rows = await client.zrevrange(this.key(gameId), 0, boundedLimit - 1, "WITHSCORES") as string[];
        if (rows.length > 0) return this.parseRedisRows(rows);
        const seeded = await this.seedRedisBoard(gameId, client);
        if (seeded.length > 0) return seeded.slice(0, boundedLimit);
      } catch {
        this.reportFailure();
      }
    }
    return (await this.localBoard(gameId)).range(0, boundedLimit - 1).map((entry) => ({
      userId: Number(entry.member),
      score: entry.score,
    }));
  }

  private async localBoard(gameId: number): Promise<SortedSet> {
    const existing = this.localBoards.get(gameId);
    if (existing) return existing;
    const board = new SortedSet();
    const rows = await prisma.gameScore.findMany({
      where: { gameId },
      orderBy: [{ score: "desc" }, { updatedAt: "desc" }],
      take: LOCAL_BOARD_LIMIT,
      select: { userId: true, score: true },
    });
    for (const row of rows) board.add(String(row.userId), row.score);
    this.localBoards.set(gameId, board);
    return board;
  }

  private async seedRedisBoard(gameId: number, client: Redis): Promise<LeaderboardMember[]> {
    const board = await this.localBoard(gameId);
    const entries = board.range(0, LOCAL_BOARD_LIMIT - 1);
    if (entries.length > 0) {
      const pipeline = client.pipeline();
      for (const entry of entries) pipeline.zadd(this.key(gameId), entry.score, entry.member);
      await pipeline.exec();
    }
    return entries.map((entry) => ({ userId: Number(entry.member), score: entry.score }));
  }

  private parseRedisRows(rows: string[]): LeaderboardMember[] {
    const members: LeaderboardMember[] = [];
    for (let index = 0; index + 1 < rows.length; index += 2) {
      const userId = Number(rows[index]);
      const score = Number(rows[index + 1]);
      if (Number.isSafeInteger(userId) && userId > 0 && Number.isFinite(score)) members.push({ userId, score });
    }
    return members;
  }

  private key(gameId: number): string {
    return `nexus:leaderboard:${gameId}`;
  }

  private async getRedis(): Promise<Redis | null> {
    if (!this.redis) return null;
    if (!this.connection) {
      this.connection = this.redis.connect().then(() => this.redis).catch(() => {
        this.connection = undefined;
        this.reportFailure();
        return null;
      });
    }
    return this.connection;
  }

  private reportFailure(): void {
    const now = Date.now();
    if (now - this.lastErrorAt <= 60_000) return;
    this.lastErrorAt = now;
    console.error("Leaderboard Redis operation failed; using the local sorted-set fallback.");
  }
}

export const leaderboard = new LeaderboardStore();
