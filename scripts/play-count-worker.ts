import { existsSync } from "node:fs";
import { resolve } from "node:path";

const envPath = resolve(process.cwd(), ".env");
if (existsSync(envPath)) process.loadEnvFile(envPath);

const { aggregatePlayCounts, prunePlayHistory } = await import("../src/lib/play-counts");
const { prisma } = await import("../src/lib/prisma");

function envInteger(name: string, fallback: number, min: number, max: number): number {
  const value = Number(process.env[name]);
  return Number.isFinite(value) && value > 0 ? Math.min(max, Math.max(min, Math.trunc(value))) : fallback;
}

const batchSize = envInteger("PLAY_COUNT_BATCH_SIZE", 5_000, 1, 20_000);
const intervalMs = envInteger("PLAY_COUNT_WORKER_INTERVAL_MS", 1_000, 100, 60_000);
const guestRetentionDays = envInteger("PLAY_HISTORY_GUEST_RETENTION_DAYS", 90, 1, 3_650);
const userRetentionDays = envInteger("PLAY_HISTORY_USER_RETENTION_DAYS", 365, 1, 3_650);
const runOnce = process.argv.includes("--once");
let stopping = false;
let lastRetentionAt = 0;

function delay(ms: number): Promise<void> {
  return new Promise((resolveDelay) => setTimeout(resolveDelay, ms));
}

async function runCycle(): Promise<void> {
  const processed = await aggregatePlayCounts(batchSize);
  if (processed > 0) console.log(`Aggregated ${processed} play events.`);

  if (Date.now() - lastRetentionAt >= 3_600_000) {
    const deleted = await prunePlayHistory(guestRetentionDays, userRetentionDays);
    if (deleted > 0) console.log(`Pruned ${deleted} expired play-history rows.`);
    lastRetentionAt = Date.now();
  }

  if (!processed && !runOnce) await delay(intervalMs);
}

process.on("SIGINT", () => { stopping = true; });
process.on("SIGTERM", () => { stopping = true; });

try {
  do {
    await runCycle();
  } while (!stopping && !runOnce);
} catch (error) {
  console.error("Play-count worker stopped after an error.", error);
  process.exitCode = 1;
} finally {
  await prisma.$disconnect();
}
