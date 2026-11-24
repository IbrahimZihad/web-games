"use client";

import { createContext, useCallback, useContext, useEffect, useMemo, useState, type ReactNode } from "react";
import { graphqlRequest } from "@/lib/client-graphql";
import type { SessionUser } from "@/lib/types";

const FAVORITES_KEY = "nexus:favorites";
const HISTORY_KEY = "nexus:history";

interface HistoryEntry {
  gameId: number;
  playedAt: string;
}

interface Toast {
  id: number;
  message: string;
  tone: "success" | "error" | "info";
}

interface AppContextValue {
  user: SessionUser | null;
  authLoading: boolean;
  favoriteIds: number[];
  history: HistoryEntry[];
  favoritesOpen: boolean;
  setFavoritesOpen: (open: boolean) => void;
  authMode: "login" | "register" | null;
  openAuth: (mode?: "login" | "register") => void;
  closeAuth: () => void;
  login: (email: string, password: string) => Promise<SessionUser>;
  register: (username: string, email: string, password: string) => Promise<SessionUser>;
  logout: () => Promise<void>;
  toggleFavorite: (gameId: number) => Promise<void>;
  recordHistory: (gameId: number) => Promise<void>;
  isFavorite: (gameId: number) => boolean;
  refreshLibrary: () => Promise<void>;
  notify: (message: string, tone?: Toast["tone"]) => void;
  toasts: Toast[];
  dismissToast: (id: number) => void;
}

const AppContext = createContext<AppContextValue | null>(null);

function readStoredFavorites(): number[] {
  try {
    const value = JSON.parse(localStorage.getItem(FAVORITES_KEY) || "[]");
    return Array.isArray(value) ? value.filter((item): item is number => Number.isSafeInteger(item)) : [];
  } catch {
    return [];
  }
}

function readStoredHistory(): HistoryEntry[] {
  try {
    const value = JSON.parse(localStorage.getItem(HISTORY_KEY) || "[]");
    return Array.isArray(value)
      ? value.filter((item): item is HistoryEntry => Number.isSafeInteger(item?.gameId) && typeof item?.playedAt === "string").slice(0, 60)
      : [];
  } catch {
    return [];
  }
}

export function AppProviders({ children }: { children: ReactNode }) {
  const [user, setUser] = useState<SessionUser | null>(null);
  const [authLoading, setAuthLoading] = useState(true);
  const [favoriteIds, setFavoriteIds] = useState<number[]>([]);
  const [history, setHistory] = useState<HistoryEntry[]>([]);
  const [favoritesOpen, setFavoritesOpen] = useState(false);
  const [authMode, setAuthMode] = useState<"login" | "register" | null>(null);
  const [toasts, setToasts] = useState<Toast[]>([]);

  const dismissToast = useCallback((id: number) => {
    setToasts((current) => current.filter((toast) => toast.id !== id));
  }, []);

  const notify = useCallback((message: string, tone: Toast["tone"] = "info") => {
    const id = Date.now() + Math.random();
    setToasts((current) => [...current.slice(-2), { id, message, tone }]);
    window.setTimeout(() => dismissToast(id), 4200);
  }, [dismissToast]);

  const loadGuestLibrary = useCallback(() => {
    setFavoriteIds(readStoredFavorites());
    setHistory(readStoredHistory());
  }, []);

  const refreshLibrary = useCallback(async () => {
    if (!user) {
      loadGuestLibrary();
      return;
    }
    const data = await graphqlRequest<{
      myLibrary: { favorites: { id: number }[]; playHistory: { game: { id: number }; playedAt: string }[] };
    }>("{ myLibrary { favorites { id } playHistory { game { id } playedAt } } }");
    setFavoriteIds(data.myLibrary.favorites.map((game) => game.id));
    setHistory(data.myLibrary.playHistory.map((item) => ({ gameId: item.game.id, playedAt: item.playedAt })));
  }, [loadGuestLibrary, user]);

  useEffect(() => {
    let active = true;
    graphqlRequest<{ me: SessionUser | null }>("{ me { id username email avatarUrl role } }")
      .then(async (data) => {
        if (!active) return;
        setUser(data.me);
        if (data.me) {
          const library = await graphqlRequest<{
            myLibrary: { favorites: { id: number }[]; playHistory: { game: { id: number }; playedAt: string }[] };
          }>("{ myLibrary { favorites { id } playHistory { game { id } playedAt } } }");
          if (!active) return;
          setFavoriteIds(library.myLibrary.favorites.map((game) => game.id));
          setHistory(library.myLibrary.playHistory.map((item) => ({ gameId: item.game.id, playedAt: item.playedAt })));
        } else {
          loadGuestLibrary();
        }
      })
      .catch(() => {
        if (active) loadGuestLibrary();
      })
      .finally(() => {
        if (active) setAuthLoading(false);
      });
    return () => {
      active = false;
    };
  }, [loadGuestLibrary]);

  const completeSignIn = useCallback(async (signedInUser: SessionUser) => {
    const guestFavorites = readStoredFavorites();
    const guestHistory = readStoredHistory();
    setUser(signedInUser);
    setAuthMode(null);
    await graphqlRequest<{ syncGuestLibrary: boolean }>(
      `mutation SyncLibrary($favoriteGameIds: [ID!], $playedGameIds: [ID!]) {
        syncGuestLibrary(favoriteGameIds: $favoriteGameIds, playedGameIds: $playedGameIds)
      }`,
      { favoriteGameIds: guestFavorites.map(String), playedGameIds: guestHistory.map((item) => String(item.gameId)) },
    ).catch(() => null);
    const library = await graphqlRequest<{
      myLibrary: { favorites: { id: number }[]; playHistory: { game: { id: number }; playedAt: string }[] };
    }>("{ myLibrary { favorites { id } playHistory { game { id } playedAt } } }");
    setFavoriteIds(library.myLibrary.favorites.map((game) => game.id));
    setHistory(library.myLibrary.playHistory.map((item) => ({ gameId: item.game.id, playedAt: item.playedAt })));
    localStorage.removeItem(FAVORITES_KEY);
    localStorage.removeItem(HISTORY_KEY);
    notify(`Welcome, ${signedInUser.username}.`, "success");
  }, [notify]);

  const login = useCallback(async (email: string, password: string) => {
    const data = await graphqlRequest<{ login: SessionUser }>(
      `mutation Login($email: String!, $password: String!) { login(email: $email, password: $password) { id username email avatarUrl role } }`,
      { email, password },
    );
    await completeSignIn(data.login);
    return data.login;
  }, [completeSignIn]);

  const register = useCallback(async (username: string, email: string, password: string) => {
    const data = await graphqlRequest<{ register: SessionUser }>(
      `mutation Register($username: String!, $email: String!, $password: String!) { register(username: $username, email: $email, password: $password) { id username email avatarUrl role } }`,
      { username, email, password },
    );
    await completeSignIn(data.register);
    return data.register;
  }, [completeSignIn]);

  const logout = useCallback(async () => {
    await graphqlRequest<{ logout: boolean }>("mutation { logout }");
    setUser(null);
    setFavoriteIds([]);
    setHistory([]);
    localStorage.removeItem(FAVORITES_KEY);
    localStorage.removeItem(HISTORY_KEY);
    notify("You have been signed out.", "info");
  }, [notify]);

  const toggleFavorite = useCallback(async (gameId: number) => {
    if (!user) {
      setFavoriteIds((current) => {
        const exists = current.includes(gameId);
        const next = exists ? current.filter((id) => id !== gameId) : [gameId, ...current];
        localStorage.setItem(FAVORITES_KEY, JSON.stringify(next));
        notify(exists ? "Removed from favorites." : "Saved to favorites.", "success");
        return next;
      });
      return;
    }

    const data = await graphqlRequest<{ toggleFavorite: boolean }>(
      "mutation ToggleFavorite($gameId: ID!) { toggleFavorite(gameId: $gameId) }",
      { gameId: String(gameId) },
    );
    setFavoriteIds((current) => data.toggleFavorite ? [gameId, ...current.filter((id) => id !== gameId)] : current.filter((id) => id !== gameId));
    notify(data.toggleFavorite ? "Saved to favorites." : "Removed from favorites.", "success");
  }, [notify, user]);

  const recordHistory = useCallback(async (gameId: number) => {
    const playedAt = new Date().toISOString();
    setHistory((current) => [{ gameId, playedAt }, ...current.filter((item) => item.gameId !== gameId)].slice(0, 60));
    await graphqlRequest<{ recordPlay: boolean }>(
      "mutation RecordPlay($gameId: ID!) { recordPlay(gameId: $gameId) }",
      { gameId: String(gameId) },
    );
    if (!user) {
      const next = [{ gameId, playedAt }, ...readStoredHistory().filter((item) => item.gameId !== gameId)].slice(0, 60);
      localStorage.setItem(HISTORY_KEY, JSON.stringify(next));
    }
  }, [user]);

  const value = useMemo<AppContextValue>(() => ({
    user,
    authLoading,
    favoriteIds,
    history,
    favoritesOpen,
    setFavoritesOpen,
    authMode,
    openAuth: (mode = "login") => setAuthMode(mode),
    closeAuth: () => setAuthMode(null),
    login,
    register,
    logout,
    toggleFavorite,
    recordHistory,
    isFavorite: (gameId) => favoriteIds.includes(gameId),
    refreshLibrary,
    notify,
    toasts,
    dismissToast,
  }), [authLoading, authMode, dismissToast, favoriteIds, favoritesOpen, history, login, logout, notify, recordHistory, refreshLibrary, register, toasts, toggleFavorite, user]);

  return <AppContext.Provider value={value}>{children}</AppContext.Provider>;
}

export function useApp() {
  const context = useContext(AppContext);
  if (!context) throw new Error("useApp must be used within AppProviders.");
  return context;
}
