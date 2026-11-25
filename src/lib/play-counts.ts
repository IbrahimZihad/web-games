import { Prisma } from "@prisma/client";
import { prisma } from "@/lib/prisma";

const DEFAULT_BATCH_SIZE = 5_000;
const RETENTION_BATCH_SIZE = 2_000;

function isRetryableDatabaseError(error: unknown): boolean {
  if (typeof error !== "object" || error === null || !("code" in error) || error.code !== "P2010") return false;
  const meta = "meta" in error ? error.meta : null;
  return typeof meta === "object" && meta !== null && "code" in meta &&
    (meta.code === 1213 || meta.code === 1205);
}

async function aggregateBatch(limit: number): Promise<number> {
  return prisma.$transaction(async (tx) => {
    const claimed = await tx.$queryRaw<Array<{ id: bigint; gameId: number }>>`
      SELECT id, gameId
      FROM PlayHistory
      WHERE countedAt IS NULL
      ORDER BY id
      LIMIT ${limit}
      FOR UPDATE SKIP LOCKED
    `;

    if (!claimed.length) return 0;

    const ids = claimed.map((row) => row.id);
    await tx.$executeRaw`
      UPDATE Game AS g
      JOIN (
        SELECT gameId, COUNT(*) AS delta
        FROM PlayHistory
        WHERE id IN (${Prisma.join(ids)})
        GROUP BY gameId
      ) AS counts ON counts.gameId = g.id
      SET g.playCount = g.playCount + counts.delta
    `;
    await tx.playHistory.updateMany({
      where: { id: { in: ids } },
      data: { countedAt: new Date() },
    });

    return claimed.length;
  }, {
    maxWait: 10_000,
    timeout: 60_000,
    isolationLevel: Prisma.TransactionIsolationLevel.ReadCommitted,
  });
}

export async function aggregatePlayCounts(batchSize = DEFAULT_BATCH_SIZE): Promise<number> {
  const limit = Math.min(Math.max(Math.trunc(batchSize), 1), 20_000);
  for (let attempt = 0; ; attempt += 1) {
    try {
      return await aggregateBatch(limit);
    } catch (error) {
      if (!isRetryableDatabaseError(error) || attempt >= 4) throw error;
      await new Promise((resolveDelay) => setTimeout(resolveDelay, 25 * 2 ** attempt));
    }
  }
}

async function pruneHistory(userId: null | { not: null }, olderThan: Date): Promise<number> {
  let deleted = 0;

  while (true) {
    const rows = await prisma.playHistory.findMany({
      where: { userId, countedAt: { not: null }, playedAt: { lt: olderThan } },
      select: { id: true },
      orderBy: { id: "asc" },
      take: RETENTION_BATCH_SIZE,
    });
    if (!rows.length) return deleted;

    const result = await prisma.playHistory.deleteMany({ where: { id: { in: rows.map((row) => row.id) } } });
    deleted += result.count;
    if (result.count < rows.length) return deleted;
  }
}

export async function prunePlayHistory(guestRetentionDays = 90, userRetentionDays = 365): Promise<number> {
  const now = Date.now();
  const [guests, users] = await Promise.all([
    pruneHistory(null, new Date(now - guestRetentionDays * 86_400_000)),
    pruneHistory({ not: null }, new Date(now - userRetentionDays * 86_400_000)),
  ]);
  return guests + users;
}
