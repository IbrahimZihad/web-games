import { existsSync } from "node:fs";
import { createServer } from "node:http";
import { resolve } from "node:path";
import * as Sentry from "@sentry/nextjs";
import express from "express";
import { Server, type Socket } from "socket.io";
import { createAdapter } from "@socket.io/redis-adapter";
import { context, propagation, ROOT_CONTEXT, trace } from "@opentelemetry/api";
import { createRedisClient } from "../../../src/lib/redis.js";
import { verifySessionToken } from "../../../src/lib/session.js";
import { registerServiceTelemetry } from "../../../src/lib/telemetry.mjs";
import { MatchmakingService, type MatchmakingMatch } from "./matchmaking.js";
import { PresenceStore } from "./presence-store.js";
import { FifoQueue } from "./queues.js";
import { RoomRegistry } from "./room-registry.js";

const envPath = resolve(process.cwd(), ".env");
if (existsSync(envPath)) process.loadEnvFile(envPath);

const sentryDsn = process.env.NEXT_PUBLIC_SENTRY_DSN || process.env.SENTRY_DSN;
if (sentryDsn) {
  Sentry.init({
    dsn: sentryDsn,
    environment: process.env.SENTRY_ENVIRONMENT || process.env.NODE_ENV,
    tracesSampleRate: Number(process.env.SENTRY_TRACES_SAMPLE_RATE || 0),
    dataCollection: {
      userInfo: false,
      cookies: false,
      httpHeaders: false,
      httpBodies: [],
      urlQueryParams: false,
      stackFrameVariables: false,
    },
  });
}
registerServiceTelemetry("nexus-play-realtime");

const app = express();
const httpServer = createServer(app);
const port = Number(process.env.REALTIME_PORT || 3001);
const host = process.env.REALTIME_HOST || "127.0.0.1";
const appOrigin = new URL(process.env.NEXT_PUBLIC_APP_URL || "http://localhost:3000").origin;
const allowedOrigins = new Set([
  appOrigin,
  ...(process.env.REALTIME_ALLOWED_ORIGINS || "").split(",").map((value) => value.trim()).filter(Boolean),
]);
const tracer = trace.getTracer("nexus-play-realtime");
const presence = new PresenceStore();
const rooms = new RoomRegistry();
const matchmaking = new MatchmakingService(rooms);
const eventQueue = new FifoQueue<() => void | Promise<void>>();
let drainingEvents = false;
const adapterPubClient = process.env.REDIS_URL ? createRedisClient("nexus-socket-adapter-pub") : null;
const adapterSubClient = adapterPubClient?.duplicate() ?? null;

app.disable("x-powered-by");
app.use((request, response, next) => {
  response.setHeader("X-Content-Type-Options", "nosniff");
  response.setHeader("Referrer-Policy", "strict-origin-when-cross-origin");
  response.setHeader("Cache-Control", "no-store");
  const parentContext = propagation.extract(ROOT_CONTEXT, request.headers);
  context.with(parentContext, () => {
    tracer.startActiveSpan(`${request.method} ${request.path}`, (span) => {
      response.on("finish", () => {
        span.setAttribute("http.response.status_code", response.statusCode);
        span.end();
      });
      next();
    });
  });
});
app.get("/healthz", (_request, response) => {
  response.json({
    status: "ok",
    service: "nexus-play-realtime",
    presence: presence.mode,
    sessions: rooms.sessionCount,
    onlinePlayers: rooms.onlinePlayerCount,
    rooms: rooms.roomCount,
    matchmakingQueue: matchmaking.queueSize,
    eventQueue: eventQueue.size,
  });
});

const io = new Server(httpServer, {
  cors: { origin: [...allowedOrigins], credentials: true },
  allowRequest: (request, callback) => {
    const origin = request.headers.origin;
    callback(null, !origin || allowedOrigins.has(origin));
  },
  transports: ["websocket", "polling"],
  maxHttpBufferSize: 16_384,
  pingInterval: 25_000,
  pingTimeout: 20_000,
});

if (adapterPubClient && adapterSubClient) {
  adapterPubClient.on("error", () => console.error("Socket.IO Redis adapter publisher error."));
  adapterSubClient.on("error", () => console.error("Socket.IO Redis adapter subscriber error."));
  io.adapter(createAdapter(adapterPubClient, adapterSubClient));
}

function readSessionCookie(header: string | undefined): string | null {
  if (!header) return null;
  for (const part of header.split(";")) {
    const [name, ...value] = part.trim().split("=");
    if (name === "portal_session") return decodeURIComponent(value.join("="));
  }
  return null;
}

io.use(async (socket, next) => {
  try {
    const token = readSessionCookie(socket.request.headers.cookie);
    socket.data.user = token ? await verifySessionToken(token) : null;
    next();
  } catch {
    next();
  }
});

function roomName(gameId: number | null): string {
  return gameId === null ? "lobby" : `game:${gameId}`;
}

function broadcastPresence(gameId: number | null, count: number): void {
  const payload = { gameId, count };
  if (gameId === null) io.emit("presence:update", payload);
  else io.to(roomName(gameId)).emit("presence:update", payload);
}

function scheduleEventDrain(): void {
  if (drainingEvents) return;
  drainingEvents = true;
  setImmediate(() => {
    void (async () => {
      try {
        while (eventQueue.size > 0) {
          const event = eventQueue.dequeue();
          if (!event) break;
          try {
            await event();
          } catch (error) {
            Sentry.captureException(error);
          }
        }
      } finally {
        drainingEvents = false;
        if (eventQueue.size > 0) scheduleEventDrain();
      }
    })();
  });
}

function enqueueEvent(socket: Socket, event: () => void | Promise<void>): void {
  if (eventQueue.size >= 2_000) {
    socket.emit("matchmaking:error", { message: "The event queue is busy. Try again shortly." });
    return;
  }
  eventQueue.enqueue(event);
  scheduleEventDrain();
}

function emitMatches(matches: MatchmakingMatch[]): void {
  for (const match of matches) {
    for (const player of match.players) {
      const socket = io.sockets.sockets.get(player.socketId);
      if (!socket?.connected) continue;
      socket.join(match.roomId);
      socket.emit("matchmaking:matched", {
        roomId: match.roomId,
        gameId: match.gameId,
        players: match.players.map((entry) => ({
          socketId: entry.socketId,
          userId: entry.userId,
          username: entry.username,
          skill: entry.skill,
        })),
      });
    }
  }
}

io.on("connection", (socket: Socket) => {
  rooms.registerSession(socket.id, socket.data.user?.id ?? null);
  let gameId: number | null = null;
  let lastSubscribeAt = 0;
  const heartbeat = setInterval(() => {
    void presence.move(socket.id, gameId, gameId).catch(() => null);
  }, 20_000);
  heartbeat.unref();

  void presence.connect(socket.id).then((onlineCount) => {
    if (!socket.connected) return;
    socket.emit("presence:state", { gameId: null, count: onlineCount });
    broadcastPresence(null, onlineCount);
  });

  socket.on("presence:subscribe", (payload: { gameId?: number | null } | null) => {
    const now = Date.now();
    if (now - lastSubscribeAt < 500) return;
    lastSubscribeAt = now;
    const rawGameId = payload?.gameId;
    const nextGameId = rawGameId == null
      ? null
      : Number.isSafeInteger(rawGameId) && rawGameId > 0 ? rawGameId : undefined;
    if (nextGameId === undefined) {
      socket.emit("presence:error", { message: "A valid game id is required." });
      return;
    }
    if (nextGameId === gameId) return;

    void presence.move(socket.id, gameId, nextGameId).then((result) => {
      if (!socket.connected) return;
      const previousGameId = gameId;
      if (previousGameId !== nextGameId) {
        socket.leave(roomName(previousGameId));
        if (previousGameId !== null) broadcastPresence(previousGameId, result.previousCount);
      }
      gameId = nextGameId;
      socket.join(roomName(gameId));
      broadcastPresence(gameId, result.count);
      socket.emit("presence:state", { gameId, count: result.count });
    }).catch(() => {
      socket.emit("presence:error", { message: "Presence is temporarily unavailable." });
    });
  });

  socket.on("disconnect", () => {
    clearInterval(heartbeat);
    const previousGameId = gameId;
    void presence.leave(socket.id, previousGameId).then((result) => {
      if (previousGameId !== null) broadcastPresence(previousGameId, result.gameCount);
      broadcastPresence(null, result.onlineCount);
    });
  });
});

httpServer.listen(port, host, () => {
  console.log(`Nexus realtime service listening on ${host}:${port}.`);
});

let shuttingDown = false;
async function shutdown(signal: string): Promise<void> {
  if (shuttingDown) return;
  shuttingDown = true;
  console.log(`${signal} received; stopping Nexus realtime service.`);
  await new Promise<void>((resolveClose) => io.close(() => resolveClose()));
  await presence.close();
  await Promise.all([
    adapterPubClient?.status !== "end"
      ? adapterPubClient?.quit().catch(() => adapterPubClient?.disconnect())
      : undefined,
    adapterSubClient?.status !== "end"
      ? adapterSubClient?.quit().catch(() => adapterSubClient?.disconnect())
      : undefined,
  ]);
  if (sentryDsn) await Sentry.flush(2_000);
}

process.on("SIGINT", () => { void shutdown("SIGINT"); });
process.on("SIGTERM", () => { void shutdown("SIGTERM"); });
