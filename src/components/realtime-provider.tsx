"use client";

import { createContext, useContext, useEffect, useMemo, useState, type ReactNode } from "react";
import { io, type Socket } from "socket.io-client";

export interface PresenceUpdate {
  gameId: number | null;
  count: number;
}

interface RealtimeContextValue {
  socket: Socket | null;
  connected: boolean;
  onlineCount: number | null;
}

const RealtimeContext = createContext<RealtimeContextValue | null>(null);

function realtimeUrl(): string {
  const configured = process.env.NEXT_PUBLIC_REALTIME_URL?.trim();
  if (configured) return configured;
  return process.env.NODE_ENV === "development" ? "http://localhost:3001" : window.location.origin;
}

export function RealtimeProvider({ children }: { children: ReactNode }) {
  const [socket, setSocket] = useState<Socket | null>(null);
  const [connected, setConnected] = useState(false);
  const [onlineCount, setOnlineCount] = useState<number | null>(null);

  useEffect(() => {
    const client = io(realtimeUrl(), {
      path: "/socket.io",
      transports: ["websocket", "polling"],
      withCredentials: true,
      reconnectionAttempts: 5,
      reconnectionDelay: 1_000,
      reconnectionDelayMax: 10_000,
      timeout: 5_000,
    });
    const onConnect = () => {
      setConnected(true);
      setOnlineCount(null);
    };
    const onDisconnect = () => {
      setConnected(false);
      setOnlineCount(null);
    };
    const onPresence = (payload: PresenceUpdate) => {
      if (payload.gameId === null && Number.isSafeInteger(payload.count) && payload.count >= 0) {
        setOnlineCount(payload.count);
      }
    };
    client.on("connect", onConnect);
    client.on("disconnect", onDisconnect);
    client.on("presence:update", onPresence);
    client.on("presence:state", onPresence);
    const frame = window.requestAnimationFrame(() => setSocket(client));
    return () => {
      window.cancelAnimationFrame(frame);
      client.off("connect", onConnect);
      client.off("disconnect", onDisconnect);
      client.off("presence:update", onPresence);
      client.off("presence:state", onPresence);
      client.disconnect();
    };
  }, []);

  const value = useMemo(() => ({ socket, connected, onlineCount }), [connected, onlineCount, socket]);
  return <RealtimeContext.Provider value={value}>{children}</RealtimeContext.Provider>;
}

export function useRealtime(): RealtimeContextValue {
  const context = useContext(RealtimeContext);
  if (!context) throw new Error("useRealtime must be used within RealtimeProvider.");
  return context;
}

export function useGamePresence(gameId: number, enabled: boolean): number | null {
  const { socket, connected } = useRealtime();
  const [presence, setPresence] = useState<{ gameId: number; count: number } | null>(null);

  useEffect(() => {
    if (!enabled || !socket || !connected) return;
    let active = true;
    const onPresence = (payload: PresenceUpdate) => {
      if (active && payload.gameId === gameId && Number.isSafeInteger(payload.count) && payload.count >= 0) {
        setPresence({ gameId, count: payload.count });
      }
    };
    socket.on("presence:update", onPresence);
    socket.on("presence:state", onPresence);
    socket.emit("presence:subscribe", { gameId });
    return () => {
      active = false;
      socket.off("presence:update", onPresence);
      socket.off("presence:state", onPresence);
      if (socket.connected) socket.emit("presence:subscribe", { gameId: null });
    };
  }, [connected, enabled, gameId, socket]);

  return enabled && connected && presence?.gameId === gameId ? presence.count : null;
}
