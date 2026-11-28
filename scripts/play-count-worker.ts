import { existsSync } from "node:fs";
import { resolve } from "node:path";
import * as Sentry from "@sentry/nextjs";
import { trace } from "@opentelemetry/api";
import { Queue, Worker, type Job } from "bullmq";
import { registerServiceTelemetry } from "../src/lib/telemetry";

const envPath = resolve(process.cwd(), ".env");
if (existsSync(envPath)) process.loadEnvFile(envPath);

const sentryDsn = process.env.NEXT_PUBLIC_SENTRY_DSN || process.env.SENTRY_DSN;
if (sentryDsn) {
  Sentry.init({
    dsn: sentryDsn,
    environment: process.env.SENTRY_ENVIRONMENT || process.env.NODE_ENV,
    tracesSampleRate: Number(process.env.SENTRY_TRACES_SAMPLE_RATE || 0),
    sendDefaultPii: false,
  });
}
registerServiceTelemetry("nexus-play-worker");

type PlayCountJobName = "aggregate" | "retention";

type PlayCountJobData = {
  batchSize?: number;
  guestRetentionDays?: number;
  userRetentionDays?: number;
};

function envInteger(name: string, fallback: number, min: number, max: number): number {
  const value = Number(process.env[name]);
  return Number.isFinite(value) && value > 0 ? Math.min(max, Math.max(min, Math.trunc(value))) : fallback;
}

function delay(ms: number): Promise<void> {
  return new Promise((resolveDelay) => setTimeout(resolveDelay, ms));
}

async function main(): Promise<void> {
  const { aggregatePlayCounts, prunePlayHistory } = await import("../src/lib/play-counts");
  const { prisma } = await import("../src/lib/prisma");
  const batchSize = envInteger("PLAY_COUNT_BATCH_SIZE", 5_000, 1, 20_000);
  const intervalMs = envInteger("PLAY_COUNT_WORKER_INTERVAL_MS", 1_000, 100, 60_000);
  const guestRetentionDays = envInteger("PLAY_HISTORY_GUEST_RETENTION_DAYS", 90, 1, 3_650);
  const userRetentionDays = envInteger("PLAY_HISTORY_USER_RETENTION_DAYS", 365, 1, 3_650);
  const runOnce = process.argv.includes("--once");

  const tracer = trace.getTracer("nexus-play-worker");
  const aggregate = async (size = batchSize): Promise<number> => tracer.startActiveSpan(
    "play_count.aggregate",
    { attributes: { "play_count.batch_size": size } },
    async (span) => {
      try {
        const processed = await aggregatePlayCounts(size);
        span.setAttribute("play_count.processed", processed);
        if (processed > 0) console.log(`Aggregated ${processed} play events.`);
        return processed;
      } catch (error) {
        span.recordException(error instanceof Error ? error : String(error));
        throw error;
      } finally {
        span.end();
      }
    },
  );
  const prune = async (): Promise<number> => tracer.startActiveSpan(
    "play_history.prune",
    { attributes: { "play_history.guest_retention_days": guestRetentionDays, "play_history.user_retention_days": userRetentionDays } },
    async (span) => {
      try {
        const deleted = await prunePlayHistory(guestRetentionDays, userRetentionDays);
        span.setAttribute("play_history.deleted", deleted);
        if (deleted > 0) console.log(`Pruned ${deleted} expired play-history rows.`);
        return deleted;
      } catch (error) {
        span.recordException(error instanceof Error ? error : String(error));
        throw error;
      } finally {
        span.end();
      }
    },
  );

  if (runOnce || !process.env.REDIS_URL) {
    let stopping = false;
    let lastRetentionAt = 0;
    const stop = () => { stopping = true; };
    process.once("SIGINT", stop);
    process.once("SIGTERM", stop);
    try {
      do {
        const processed = await aggregate();
        if (Date.now() - lastRetentionAt >= 3_600_000 || runOnce) {
          await prune();
          lastRetentionAt = Date.now();
        }
        if (!processed && !runOnce) await delay(intervalMs);
      } while (!stopping && !runOnce);
    } finally {
      await prisma.$disconnect();
    }
    return;
  }

  const queueName = process.env.BULLMQ_QUEUE_NAME || "nexus-play-counts";
  const connection = { url: process.env.REDIS_URL, maxRetriesPerRequest: null };
  const queue = new Queue<PlayCountJobData, number, PlayCountJobName>(queueName, {
    connection,
    defaultJobOptions: {
      attempts: 5,
      backoff: { type: "exponential", delay: 1_000 },
      removeOnComplete: 100,
      removeOnFail: 500,
    },
  });

  await queue.upsertJobScheduler("play-count-aggregate", { every: intervalMs }, {
    name: "aggregate",
    data: { batchSize },
    opts: { attempts: 5, backoff: { type: "exponential", delay: 1_000 }, removeOnComplete: 100, removeOnFail: 500 },
  });
  await queue.upsertJobScheduler("play-history-retention", { every: 3_600_000 }, {
    name: "retention",
    data: { guestRetentionDays, userRetentionDays },
    opts: { attempts: 3, backoff: { type: "exponential", delay: 5_000 }, removeOnComplete: 20, removeOnFail: 100 },
  });

  const worker = new Worker<PlayCountJobData, number, PlayCountJobName>(queueName, async (job: Job<PlayCountJobData, number, PlayCountJobName>) => {
    if (job.name === "aggregate") return aggregate(job.data.batchSize);
    return prune();
  }, {
    connection,
    concurrency: 1,
    lockDuration: 120_000,
    stalledInterval: 30_000,
    maxStalledCount: 2,
  });

  worker.on("completed", (job) => console.log(`BullMQ job ${job.name} completed.`));
  worker.on("failed", (job, error) => {
    console.error(`BullMQ job ${job?.name || "unknown"} failed.`, error);
    if (sentryDsn) Sentry.captureException(error);
  });
  worker.on("error", (error) => console.error("BullMQ worker connection error.", error));
  await worker.waitUntilReady();
  console.log(`BullMQ worker ready for queue ${queueName}.`);

  let stopping = false;
  const stop = () => { stopping = true; };
  process.once("SIGINT", stop);
  process.once("SIGTERM", stop);
  while (!stopping) await delay(1_000);

  await worker.close();
  await queue.close();
  await prisma.$disconnect();
  if (sentryDsn) await Sentry.flush(2_000);
}

main().catch((error) => {
  console.error("Play-count worker stopped after an error.", error);
  if (process.env.NEXT_PUBLIC_SENTRY_DSN || process.env.SENTRY_DSN) Sentry.captureException(error);
  process.exitCode = 1;
});
