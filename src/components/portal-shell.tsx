"use client";

import { useEffect, useRef, useState, type ReactNode } from "react";
import Link from "next/link";
import { usePathname } from "next/navigation";
import { Bookmark, CheckCircle2, ChevronLeft, ChevronRight, CircleAlert, Gamepad2, Home, Menu, Search, Sparkles, Users, X } from "lucide-react";
import { AuthDialog } from "@/components/auth-dialog";
import { useCookiePreferences } from "@/components/cookie-preferences";
import { useApp } from "@/components/providers";
import { useRealtime } from "@/components/realtime-provider";
import { readSidebarCollapsed, writeSidebarCollapsed } from "@/lib/cookies";
import { formatCompact } from "@/lib/format";
import type { CategoryDTO, GameDTO } from "@/lib/types";

const navigation = [
  { label: "Home", href: "/", icon: Home },
  { label: "Recently played", href: "/recently-played", icon: Gamepad2 },
  { label: "New releases", href: "/new", icon: Sparkles },
  { label: "Trending", href: "/trending", icon: CircleAlert },
  { label: "Recently updated", href: "/updated", icon: CheckCircle2 },
  { label: "Nexus Originals", href: "/originals", icon: Bookmark },
];

const iconMap: Record<string, typeof Home> = {
  swords: ChevronRight,
  compass: ChevronLeft,
  flag: ChevronRight,
  puzzle: Sparkles,
  crosshair: CircleAlert,
  trophy: CheckCircle2,
  users: Gamepad2,
  brain: Sparkles,
  sparkles: Sparkles,
  gamepad: Gamepad2,
};

function Brand({ compact = false }: { compact?: boolean }) {
  return (
    <Link href="/" className="group flex items-center gap-3" aria-label="Nexus home">
      <span className="relative grid size-9 shrink-0 place-items-center overflow-hidden rounded-xl bg-gradient-to-br from-violet-500 via-indigo-600 to-violet-700 shadow-lg shadow-violet-950/50">
        <span className="absolute inset-[1px] rounded-[11px] border border-white/20" />
        <Gamepad2 size={21} className="relative text-white" strokeWidth={2.3} />
      </span>
      {!compact && <span className="text-lg font-black tracking-[0.14em] text-white">NEXUS<span className="text-violet-400">.</span></span>}
    </Link>
  );
}

function FavoritesDrawer() {
  const { favoritesOpen, setFavoritesOpen, favoriteIds, toggleFavorite, notify } = useApp();
  const [result, setResult] = useState<{ key: string; games: GameDTO[] } | null>(null);
  const key = favoriteIds.join(",");

  useEffect(() => {
    if (!favoritesOpen || !key) return;
    let active = true;
    import("@/lib/client-graphql").then(({ graphqlRequest }) =>
      graphqlRequest<{ gamesByIds: GameDTO[] }>(
        `query FavoriteGames($ids: [ID!]!) { gamesByIds(ids: $ids) { id title slug thumbnailUrl category { name } playCount } }`,
        { ids: key.split(",") },
      ),
    ).then((data) => {
      if (active) setResult({ key, games: data.gamesByIds });
    }).catch(() => {
      if (active) {
        setResult({ key, games: [] });
        notify("Favorites could not be loaded.", "error");
      }
    });
    return () => { active = false; };
  }, [favoritesOpen, key, notify]);

  useEffect(() => {
    if (!favoritesOpen) return;
    const onKeyDown = (event: KeyboardEvent) => { if (event.key === "Escape") setFavoritesOpen(false); };
    window.addEventListener("keydown", onKeyDown);
    return () => window.removeEventListener("keydown", onKeyDown);
  }, [favoritesOpen, setFavoritesOpen]);

  if (!favoritesOpen) return null;
  const loading = Boolean(key) && result?.key !== key;
  const games = result?.key === key ? result.games : [];

  return (
    <div className="fixed inset-0 z-[90] bg-black/65 backdrop-blur-sm" onMouseDown={(event) => { if (event.target === event.currentTarget) setFavoritesOpen(false); }}>
      <aside role="dialog" aria-modal="true" aria-label="Your favorites" className="ml-auto flex h-full w-full max-w-md flex-col border-l border-white/10 bg-[#11121c] shadow-2xl">
        <div className="flex items-center justify-between border-b border-white/[0.07] px-5 py-5">
          <div><p className="text-xs font-bold uppercase tracking-[0.18em] text-violet-300">Your library</p><h2 className="mt-1 text-xl font-bold text-white">Favorite games</h2></div>
          <button onClick={() => setFavoritesOpen(false)} className="icon-button" aria-label="Close favorites"><X size={19} /></button>
        </div>
        <div className="flex-1 overflow-y-auto p-4">
          {loading ? <div className="space-y-3">{[1, 2, 3].map((item) => <div key={item} className="skeleton h-24 rounded-xl" />)}</div> : games.length ? (
            <div className="space-y-3">
              {games.map((game) => (
                <div key={game.id} className="group flex gap-3 rounded-xl border border-white/[0.06] bg-white/[0.025] p-2.5">
                  <Link href={`/games/${game.slug}`} onClick={() => setFavoritesOpen(false)} className="relative h-[70px] w-28 shrink-0 overflow-hidden rounded-lg bg-zinc-900">
                    {/* eslint-disable-next-line @next/next/no-img-element */}
                    <img src={game.thumbnailUrl} alt="" className="h-full w-full object-cover transition group-hover:scale-105" />
                  </Link>
                  <div className="min-w-0 flex-1 py-1">
                    <Link href={`/games/${game.slug}`} onClick={() => setFavoritesOpen(false)} className="line-clamp-1 font-semibold text-white hover:text-violet-300">{game.title}</Link>
                    <p className="mt-1 text-xs text-zinc-500">{game.category.name} · {formatCompact(game.playCount)} plays</p>
                    <button onClick={() => toggleFavorite(game.id)} className="mt-2 text-xs font-semibold text-zinc-400 hover:text-rose-300">Remove</button>
                  </div>
                </div>
              ))}
            </div>
          ) : (
            <div className="flex h-full flex-col items-center justify-center px-6 text-center">
              <span className="mb-5 grid size-16 place-items-center rounded-2xl border border-violet-400/15 bg-violet-500/10 text-violet-300"><Bookmark size={28} /></span>
              <h3 className="text-lg font-bold text-white">No favorites yet</h3>
              <p className="mt-2 max-w-xs text-sm leading-6 text-zinc-500">Tap the bookmark on any game to build your personal arcade.</p>
              <Link href="/games" onClick={() => setFavoritesOpen(false)} className="primary-button mt-6">Explore games</Link>
            </div>
          )}
        </div>
        <p className="border-t border-white/[0.06] px-5 py-4 text-xs leading-5 text-zinc-600">Guest favorites stay in this browser and sync when you sign in.</p>
      </aside>
    </div>
  );
}

function Toasts() {
  const { toasts, dismissToast } = useApp();
  return (
    <div aria-live="polite" className="pointer-events-none fixed bottom-5 right-5 z-[120] flex w-[calc(100%-2.5rem)] max-w-sm flex-col gap-2">
      {toasts.map((toast) => (
        <div key={toast.id} className={`pointer-events-auto flex items-center gap-3 rounded-xl border px-4 py-3 text-sm shadow-xl backdrop-blur-xl ${toast.tone === "error" ? "border-rose-400/20 bg-rose-950/90 text-rose-100" : toast.tone === "success" ? "border-emerald-400/20 bg-emerald-950/90 text-emerald-100" : "border-white/10 bg-zinc-900/95 text-zinc-100"}`}>
          <span className="flex-1">{toast.message}</span>
          <button onClick={() => dismissToast(toast.id)} aria-label="Dismiss notification" className="rounded p-1 opacity-60 hover:opacity-100"><X size={15} /></button>
        </div>
      ))}
    </div>
  );
}

export function PortalShell({ children }: { children: ReactNode }) {
  const pathname = usePathname();
  const { user, authLoading, favoriteIds, setFavoritesOpen, openAuth, logout } = useApp();
  const { preferencesEnabled, openSettings } = useCookiePreferences();
  const { connected: realtimeConnected, onlineCount } = useRealtime();
  const [collapsed, setCollapsed] = useState(false);
  const [mobileOpen, setMobileOpen] = useState(false);
  const [categories, setCategories] = useState<CategoryDTO[]>([]);
  const [query, setQuery] = useState("");
  const [results, setResults] = useState<GameDTO[]>([]);
  const [searching, setSearching] = useState(false);
  const [searchOpen, setSearchOpen] = useState(false);
  const [profileOpen, setProfileOpen] = useState(false);
  const searchRef = useRef<HTMLInputElement>(null);

  useEffect(() => {
    const frame = window.requestAnimationFrame(() => setCollapsed(readSidebarCollapsed()));
    return () => window.cancelAnimationFrame(frame);
  }, [preferencesEnabled]);

  useEffect(() => {
    import("@/lib/client-graphql").then(({ graphqlRequest }) =>
      graphqlRequest<{ categories: CategoryDTO[] }>("{ categories { id name slug iconName gameCount } }"),
    ).then((data) => setCategories(data.categories)).catch(() => null);
  }, []);

  useEffect(() => {
    const timer = window.setTimeout(() => {
      setMobileOpen(false);
      setSearchOpen(false);
      setProfileOpen(false);
    }, 0);
    return () => window.clearTimeout(timer);
  }, [pathname]);

  useEffect(() => {
    const onKeyDown = (event: KeyboardEvent) => {
      const target = event.target as HTMLElement;
      const typing = target.tagName === "INPUT" || target.tagName === "TEXTAREA" || target.isContentEditable;
      if ((event.metaKey || event.ctrlKey) && event.key.toLowerCase() === "k") {
        event.preventDefault();
        searchRef.current?.focus();
      } else if (event.key === "/" && !typing) {
        event.preventDefault();
        searchRef.current?.focus();
      }
    };
    window.addEventListener("keydown", onKeyDown);
    return () => window.removeEventListener("keydown", onKeyDown);
  }, []);

  useEffect(() => {
    const value = query.trim();
    if (value.length < 2) return;
    let active = true;
    const timer = window.setTimeout(() => {
      import("@/lib/client-graphql").then(({ graphqlRequest }) =>
        graphqlRequest<{ games: GameDTO[] }>(
          `query SearchGames($search: String!) { games(search: $search, limit: 6) { id title slug thumbnailUrl category { name } playCount } }`,
          { search: value },
        ),
      ).then((data) => { if (active) setResults(data.games); }).catch(() => { if (active) setResults([]); }).finally(() => { if (active) setSearching(false); });
    }, 260);
    return () => { active = false; window.clearTimeout(timer); };
  }, [query]);

  function toggleCollapsed() {
    setCollapsed((current) => {
      const next = !current;
      writeSidebarCollapsed(next);
      return next;
    });
  }

  return (
    <div className="min-h-screen">
      {mobileOpen && <button className="fixed inset-0 z-50 bg-black/70 backdrop-blur-sm lg:hidden" onClick={() => setMobileOpen(false)} aria-label="Close navigation" />}
      <aside className={`fixed inset-y-0 left-0 z-[60] flex flex-col border-r border-white/[0.06] bg-[#10111b] transition-[width,transform] duration-300 ${collapsed ? "lg:w-[84px]" : "w-[248px] lg:w-[248px]"} ${mobileOpen ? "translate-x-0" : "-translate-x-full lg:translate-x-0"}`}>
        <div className={`flex h-[76px] items-center border-b border-white/[0.06] ${collapsed ? "justify-center lg:px-2" : "justify-between px-5"}`}>
          <Brand compact={collapsed} />
          {!collapsed && <button className="hidden rounded-lg p-1.5 text-zinc-600 hover:bg-white/5 hover:text-white lg:block" onClick={toggleCollapsed} aria-label="Collapse sidebar"><ChevronLeft size={17} /></button>}
        </div>
        <div className="flex-1 overflow-y-auto px-3 py-5">
          <nav aria-label="Main navigation" className="space-y-1">
            {navigation.map((item) => {
              const active = item.href === "/" ? pathname === "/" : pathname.startsWith(item.href);
              const Icon = item.icon;
              return (
                <Link key={item.href} href={item.href} title={collapsed ? item.label : undefined} className={`group flex items-center rounded-xl py-3 text-sm font-medium transition ${collapsed ? "lg:justify-center lg:px-2" : "gap-3 px-3.5"} ${active ? "bg-violet-500/12 text-violet-200" : "text-zinc-500 hover:bg-white/[0.035] hover:text-zinc-200"}`}>
                  <Icon size={18} className={active ? "text-violet-300" : "text-zinc-600 group-hover:text-zinc-300"} />
                  {!collapsed && <span>{item.label}</span>}
                  {!collapsed && active && <span className="ml-auto size-1.5 rounded-full bg-violet-400" />}
                </Link>
              );
            })}
          </nav>
          {!collapsed && <p className="mb-3 mt-8 px-3.5 text-[10px] font-bold uppercase tracking-[0.2em] text-zinc-700">Categories</p>}
          <nav aria-label="Game categories" className="space-y-1">
            {categories.map((category) => {
              const active = pathname === `/category/${category.slug}`;
              const Icon = iconMap[category.iconName] || Gamepad2;
              return (
                <Link key={category.id} href={`/category/${category.slug}`} title={collapsed ? category.name : undefined} className={`group flex items-center rounded-xl py-2.5 text-sm transition ${collapsed ? "lg:justify-center lg:px-2" : "gap-3 px-3.5"} ${active ? "bg-violet-500/12 text-violet-200" : "text-zinc-500 hover:bg-white/[0.035] hover:text-zinc-300"}`}>
                  <Icon size={17} className="text-zinc-600 group-hover:text-violet-300" />
                  {!collapsed && <><span>{category.name}</span><span className="ml-auto text-[10px] tabular-nums text-zinc-700">{category.gameCount}</span></>}
                </Link>
              );
            })}
          </nav>
        </div>
        <div className="border-t border-white/[0.06] p-3">
          {!collapsed && <div className="mb-3 overflow-hidden rounded-xl border border-violet-400/10 bg-gradient-to-br from-violet-500/10 to-indigo-500/[0.03] p-3.5"><p className="text-xs font-bold text-violet-200">Your arcade, everywhere.</p><p className="mt-1.5 text-[11px] leading-5 text-zinc-500">Create a free account to keep your favorites and play history in sync.</p><button onClick={() => openAuth("register")} className="mt-3 text-xs font-bold text-violet-300 hover:text-white">Join Nexus →</button></div>}
          <button onClick={toggleCollapsed} className={`hidden w-full items-center rounded-lg py-2 text-xs text-zinc-600 hover:bg-white/5 hover:text-zinc-300 lg:flex ${collapsed ? "justify-center" : "justify-center gap-2"}`} aria-label={collapsed ? "Expand sidebar" : "Collapse sidebar"}><ChevronRight size={15} className={collapsed ? "" : "rotate-180"} />{!collapsed && "Collapse"}</button>
        </div>
      </aside>

      <div className={`transition-[margin] duration-300 ${collapsed ? "lg:ml-[84px]" : "lg:ml-[248px]"}`}>
        <header className="sticky top-0 z-40 flex h-[76px] items-center gap-3 border-b border-white/[0.06] bg-[#0c0d14]/90 px-4 backdrop-blur-xl sm:px-6 lg:px-8">
          <button onClick={() => setMobileOpen(true)} className="icon-button lg:hidden" aria-label="Open navigation"><Menu size={20} /></button>
          <div className="relative ml-auto w-full max-w-[520px] sm:ml-0">
            <Search size={17} className="pointer-events-none absolute left-3.5 top-1/2 -translate-y-1/2 text-zinc-600" />
            <input
              ref={searchRef}
              value={query}
              onChange={(event) => {
                const value = event.target.value;
                setQuery(value);
                setSearchOpen(true);
                setResults([]);
                setSearching(value.trim().length >= 2);
              }}
              onFocus={() => setSearchOpen(true)}
              onBlur={() => window.setTimeout(() => setSearchOpen(false), 150)}
              placeholder="Search games, categories, tags..."
              aria-label="Search games"
              className="h-11 w-full rounded-xl border border-white/[0.07] bg-white/[0.035] pl-10 pr-14 text-sm text-white outline-none transition placeholder:text-zinc-600 focus:border-violet-400/40 focus:bg-white/[0.05] focus:ring-2 focus:ring-violet-500/10"
            />
            <kbd className="pointer-events-none absolute right-3 top-1/2 hidden -translate-y-1/2 rounded border border-white/10 bg-black/20 px-1.5 py-0.5 text-[10px] text-zinc-600 sm:block">⌘ K</kbd>
            {searchOpen && query.trim().length >= 2 && (
              <div className="absolute left-0 right-0 top-[calc(100%+8px)] overflow-hidden rounded-xl border border-white/10 bg-[#171824] p-2 shadow-2xl">
                <p className="px-2 py-2 text-[10px] font-bold uppercase tracking-widest text-zinc-600">{searching ? "Searching..." : `${results.length} result${results.length === 1 ? "" : "s"}`}</p>
                {results.map((game) => (
                  <Link key={game.id} href={`/games/${game.slug}`} onMouseDown={(event) => event.preventDefault()} className="flex items-center gap-3 rounded-lg p-2 hover:bg-white/[0.05]">
                    {/* eslint-disable-next-line @next/next/no-img-element */}
                    <img src={game.thumbnailUrl} alt="" className="h-11 w-20 rounded-md object-cover" />
                    <span className="min-w-0"><span className="block truncate text-sm font-semibold text-white">{game.title}</span><span className="text-xs text-zinc-500">{game.category.name} · {formatCompact(game.playCount)} plays</span></span>
                  </Link>
                ))}
                {!searching && !results.length && <p className="px-3 py-6 text-center text-sm text-zinc-500">No games found. Try another title or tag.</p>}
              </div>
            )}
          </div>
          {realtimeConnected && onlineCount !== null && (
            <div className="hidden shrink-0 items-center gap-2 rounded-xl border border-emerald-400/10 bg-emerald-400/[0.04] px-3 py-2 text-xs font-semibold text-emerald-300 md:flex" title="Players currently online">
              <span className="relative flex size-2"><span className="absolute inline-flex size-full animate-ping rounded-full bg-emerald-400 opacity-50" /><span className="relative inline-flex size-2 rounded-full bg-emerald-400" /></span>
              <Users size={14} />{formatCompact(onlineCount)} live
            </div>
          )}
          <button onClick={() => setFavoritesOpen(true)} className="icon-button relative shrink-0" aria-label={`Open favorites, ${favoriteIds.length} saved`}>
            <Bookmark size={19} />
            {favoriteIds.length > 0 && <span className="absolute -right-1 -top-1 grid min-h-4 min-w-4 place-items-center rounded-full bg-violet-500 px-1 text-[9px] font-bold text-white">{favoriteIds.length}</span>}
          </button>
          <div className="relative shrink-0" onBlur={(event) => { if (!event.currentTarget.contains(event.relatedTarget)) setProfileOpen(false); }}>
            {authLoading ? <div className="skeleton h-10 w-24 rounded-xl" /> : user ? (
              <button onClick={() => setProfileOpen((value) => !value)} className="flex h-10 items-center gap-2 rounded-xl border border-white/[0.07] bg-white/[0.035] px-2.5 text-sm font-semibold text-zinc-200 hover:bg-white/[0.06]">
                <span className="grid size-6 place-items-center rounded-lg bg-gradient-to-br from-violet-400 to-indigo-600 text-[11px] font-black text-white">{user.username.slice(0, 1).toUpperCase()}</span>
                <span className="hidden max-w-24 truncate sm:block">{user.username}</span>
              </button>
            ) : (
              <button onClick={() => openAuth("login")} className="primary-button h-10 px-4 text-sm">Sign in</button>
            )}
            {profileOpen && user && (
              <div className="absolute right-0 top-[calc(100%+8px)] w-60 rounded-xl border border-white/10 bg-[#171824] p-2 shadow-2xl">
                <div className="border-b border-white/[0.06] px-3 py-3"><p className="font-semibold text-white">{user.username}</p><p className="mt-0.5 truncate text-xs text-zinc-500">{user.email}</p><span className="mt-2 inline-block rounded bg-violet-500/10 px-2 py-0.5 text-[10px] font-bold uppercase tracking-wider text-violet-300">{user.role}</span></div>
                <Link href="/favorites" className="mt-1 block rounded-lg px-3 py-2.5 text-sm text-zinc-300 hover:bg-white/5">My favorites</Link>
                <Link href="/recently-played" className="block rounded-lg px-3 py-2.5 text-sm text-zinc-300 hover:bg-white/5">Play history</Link>
                {user.role === "ADMIN" && <Link href="/admin" className="block rounded-lg px-3 py-2.5 text-sm text-violet-300 hover:bg-white/5">Admin dashboard</Link>}
                <button onClick={() => { setProfileOpen(false); void logout(); }} className="mt-1 w-full rounded-lg border-t border-white/[0.06] px-3 py-2.5 text-left text-sm text-zinc-400 hover:bg-white/5 hover:text-white">Sign out</button>
              </div>
            )}
          </div>
        </header>
        <main className="mx-auto w-full max-w-[1700px] px-4 pb-20 pt-6 sm:px-6 lg:px-8 lg:pt-8">{children}</main>
        <footer className="mx-auto flex w-full max-w-[1700px] flex-col gap-3 border-t border-white/[0.05] px-6 py-8 text-xs text-zinc-700 sm:flex-row sm:items-center sm:justify-between lg:px-8"><p>© 2026 Nexus Play. Built for the joy of play.</p><div className="flex flex-wrap gap-5"><Link href="/games" className="hover:text-zinc-400">All games</Link><Link href="/new" className="hover:text-zinc-400">New releases</Link><span>No downloads. Just play.</span><button type="button" onClick={openSettings} className="hover:text-zinc-400">Cookie settings</button></div></footer>
      </div>
      <FavoritesDrawer />
      <AuthDialog />
      <Toasts />
    </div>
  );
}

export function SiteChrome({ children }: { children: ReactNode }) {
  const pathname = usePathname();
  if (pathname === "/login" || pathname.startsWith("/admin")) return <>{children}</>;
  return <PortalShell>{children}</PortalShell>;
}
