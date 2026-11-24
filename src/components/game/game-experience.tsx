"use client";

import { useEffect, useRef, useState, type FormEvent } from "react";
import Image from "next/image";
import Link from "next/link";
import {
  Bookmark, Building2, CalendarDays, Check, ChevronRight, Expand, Gamepad2,
  Heart, LoaderCircle, Maximize, MessageCircle, Minimize, Monitor, Play,
  RotateCcw, Share2, Smartphone, Star, ThumbsDown, ThumbsUp, X,
} from "lucide-react";
import ReactMarkdown from "react-markdown";
import remarkGfm from "remark-gfm";
import { useApp } from "@/components/providers";
import { GameGrid } from "@/components/game-row";
import { graphqlRequest } from "@/lib/client-graphql";
import { cn, formatCompact, formatDate } from "@/lib/format";
import type { CommentDTO, GameDTO, VoteType } from "@/lib/types";

const ratioClasses: Record<GameDTO["aspectRatio"], string> = {
  RATIO_16_9: "aspect-video",
  RATIO_4_3: "aspect-[4/3]",
  RATIO_9_16: "aspect-[9/16] max-w-[430px]",
  RESPONSIVE: "h-[min(72vh,760px)]",
};

export function GameExperience({ game }: { game: GameDTO }) {
  const { user, isFavorite, toggleFavorite, recordHistory, openAuth, notify } = useApp();
  const [playing, setPlaying] = useState(false);
  const [loading, setLoading] = useState(false);
  const [theater, setTheater] = useState(false);
  const [fullscreen, setFullscreen] = useState(false);
  const [frameKey, setFrameKey] = useState(0);
  const [playCount, setPlayCount] = useState(game.playCount);
  const [votes, setVotes] = useState({ likes: game.likesCount, dislikes: game.dislikesCount });
  const [vote, setVote] = useState<VoteType | null>(null);
  const [comments, setComments] = useState<CommentDTO[]>(game.comments);
  const [commentBody, setCommentBody] = useState("");
  const [submittingComment, setSubmittingComment] = useState(false);
  const [score, setScore] = useState<number | null>(null);
  const containerRef = useRef<HTMLDivElement>(null);
  const iframeRef = useRef<HTMLIFrameElement>(null);
  const saved = isFavorite(game.id);

  useEffect(() => {
    const onFullscreen = () => setFullscreen(Boolean(document.fullscreenElement));
    document.addEventListener("fullscreenchange", onFullscreen);
    return () => document.removeEventListener("fullscreenchange", onFullscreen);
  }, []);

  useEffect(() => {
    if (!theater) return;
    const previous = document.body.style.overflow;
    document.body.style.overflow = "hidden";
    const onKeyDown = (event: KeyboardEvent) => { if (event.key === "Escape") setTheater(false); };
    window.addEventListener("keydown", onKeyDown);
    return () => { document.body.style.overflow = previous; window.removeEventListener("keydown", onKeyDown); };
  }, [theater]);

  useEffect(() => {
    const onMessage = (event: MessageEvent) => {
      if (event.source !== iframeRef.current?.contentWindow) return;
      if (event.data?.type === "GAME_SCORE" && Number.isFinite(event.data.score)) setScore(Number(event.data.score));
      if (event.data?.type === "NEXUS_READY") setLoading(false);
    };
    window.addEventListener("message", onMessage);
    return () => window.removeEventListener("message", onMessage);
  }, []);

  async function startGame() {
    setPlaying(true);
    setLoading(true);
    setPlayCount((count) => count + 1);
    try {
      await recordHistory(game.id);
    } catch {
      notify("The game is ready, but play history could not be saved.", "error");
    }
  }

  async function handleVote(nextVote: VoteType) {
    if (!user) {
      notify("Sign in to rate this game.", "info");
      openAuth("login");
      return;
    }
    try {
      const data = await graphqlRequest<{ voteGame: GameDTO }>(
        "mutation VoteGame($gameId: ID!, $vote: VoteType!) { voteGame(gameId: $gameId, vote: $vote) { id likesCount dislikesCount } }",
        { gameId: String(game.id), vote: nextVote },
      );
      setVotes({ likes: data.voteGame.likesCount, dislikes: data.voteGame.dislikesCount });
      setVote((current) => current === nextVote ? null : nextVote);
    } catch (error) {
      notify(error instanceof Error ? error.message : "Your vote could not be saved.", "error");
    }
  }

  async function save() {
    try { await toggleFavorite(game.id); } catch { notify("The favorite could not be updated.", "error"); }
  }

  async function toggleFullscreen() {
    try {
      if (document.fullscreenElement) await document.exitFullscreen();
      else await containerRef.current?.requestFullscreen();
    } catch {
      notify("Fullscreen is not available in this browser.", "error");
    }
  }

  async function share() {
    try {
      await navigator.clipboard.writeText(window.location.href);
      notify("Game link copied to clipboard.", "success");
    } catch {
      notify("Copy the page URL to share this game.", "info");
    }
  }

  async function postComment(event: FormEvent<HTMLFormElement>) {
    event.preventDefault();
    if (!user) { openAuth("login"); return; }
    const body = commentBody.trim();
    if (!body) return;
    setSubmittingComment(true);
    try {
      const data = await graphqlRequest<{ addComment: CommentDTO }>(
        `mutation AddComment($gameId: ID!, $body: String!) { addComment(gameId: $gameId, body: $body) { id body createdAt user { id username avatarUrl role } } }`,
        { gameId: String(game.id), body },
      );
      setComments((current) => [data.addComment, ...current]);
      setCommentBody("");
      notify("Comment posted.", "success");
    } catch (error) {
      notify(error instanceof Error ? error.message : "Your comment could not be posted.", "error");
    } finally {
      setSubmittingComment(false);
    }
  }

  const positive = votes.likes + votes.dislikes > 0 ? Math.round((votes.likes / (votes.likes + votes.dislikes)) * 100) : 0;

  return (
    <div className="mx-auto max-w-[1500px]">
      <nav aria-label="Breadcrumb" className="mb-4 flex items-center gap-2 text-xs text-zinc-600">
        <Link href="/" className="hover:text-zinc-300">Home</Link><ChevronRight size={12} />
        <Link href={`/category/${game.category.slug}`} className="hover:text-zinc-300">{game.category.name}</Link><ChevronRight size={12} />
        <span className="truncate text-zinc-400">{game.title}</span>
      </nav>

      <div ref={containerRef} className={cn("game-player-container", theater && "fixed inset-0 z-[80] flex flex-col bg-black p-0 sm:p-4", fullscreen && "flex h-screen flex-col bg-black p-0")}>
        {theater && <div className="mb-3 flex items-center justify-between px-1 text-sm text-zinc-400"><span className="font-semibold text-white">{game.title}</span><button onClick={() => setTheater(false)} className="icon-button" aria-label="Exit theater mode"><X size={18} /></button></div>}
        <div className={cn("relative mx-auto w-full overflow-hidden rounded-xl border border-white/10 bg-black shadow-2xl shadow-black/40 sm:rounded-2xl", theater || fullscreen ? "max-w-none flex-1" : ratioClasses[game.aspectRatio])}>
          {!playing ? (
            <>
              <Image src={game.thumbnailUrl} alt={`${game.title} game cover`} fill priority sizes="(max-width: 768px) 100vw, 80vw" className="object-cover" />
              <div className="absolute inset-0 bg-black/45 backdrop-blur-[2px]" />
              <div className="absolute inset-0 bg-gradient-to-t from-black/80 via-transparent to-black/20" />
              <div className="absolute inset-0 flex flex-col items-center justify-center p-5 text-center">
                <span className="mb-4 rounded-full border border-white/15 bg-black/30 px-3 py-1 text-[10px] font-bold uppercase tracking-[0.16em] text-white/80 backdrop-blur-md">Instant play · no download</span>
                <h1 className="max-w-2xl text-3xl font-black tracking-[-0.04em] text-white sm:text-5xl">{game.title}</h1>
                <p className="mt-3 hidden max-w-lg text-sm text-zinc-300 sm:block">{game.tagline}</p>
                <button onClick={startGame} className="primary-button mt-6 h-13 px-7 text-sm sm:h-14 sm:px-8"><Play size={19} fill="currentColor" />Play now</button>
                <p className="mt-3 text-[11px] text-white/50">The game loads only when you press play.</p>
              </div>
            </>
          ) : (
            <>
              <iframe
                key={frameKey}
                ref={iframeRef}
                src={game.embedUrl}
                title={`${game.title} game`}
                className="h-full w-full border-0 bg-black"
                sandbox="allow-scripts allow-same-origin allow-pointer-lock allow-forms"
                allow="autoplay; fullscreen; gamepad; pointer-lock"
                allowFullScreen
                onLoad={() => setLoading(false)}
              />
              {loading && <div className="pointer-events-none absolute inset-0 flex flex-col items-center justify-center bg-[#0b0c12] text-zinc-400"><LoaderCircle size={30} className="animate-spin text-violet-400" /><p className="mt-4 text-sm font-semibold">Loading {game.title}…</p><p className="mt-1 text-xs text-zinc-600">Preparing your game</p></div>}
              {score !== null && <div className="pointer-events-none absolute right-3 top-3 rounded-lg border border-white/15 bg-black/65 px-3 py-2 text-xs font-bold text-white backdrop-blur-md"><span className="mr-2 text-zinc-500">SCORE</span>{score.toLocaleString()}</div>}
            </>
          )}
        </div>

        <div className={cn("mx-auto mt-0 w-full overflow-hidden rounded-b-xl border border-t-0 border-white/[0.08] bg-[#151620] sm:rounded-b-2xl", (theater || fullscreen) && "mt-3 rounded-xl border")}>
          <div className="flex min-h-16 flex-wrap items-center gap-2 px-3 py-3 sm:gap-3 sm:px-4">
            <div className="mr-auto flex min-w-0 items-center gap-3">
              <span className="hidden size-9 shrink-0 place-items-center rounded-lg bg-violet-500/15 text-violet-300 sm:grid"><Gamepad2 size={18} /></span>
              <div className="min-w-0"><p className="truncate text-sm font-bold text-white">{game.title}</p><p className="mt-0.5 text-[11px] text-zinc-600">{formatCompact(playCount)} plays</p></div>
            </div>
            <div className="flex items-center rounded-lg border border-white/[0.06] bg-black/15 p-0.5">
              <button onClick={() => handleVote("LIKE")} aria-label="Like game" className={cn("flex items-center gap-1.5 rounded-md px-2.5 py-2 text-xs font-semibold transition", vote === "LIKE" ? "bg-emerald-500/15 text-emerald-300" : "text-zinc-500 hover:bg-white/5 hover:text-emerald-300")}><ThumbsUp size={15} />{formatCompact(votes.likes)}</button>
              <span className="h-4 w-px bg-white/[0.07]" />
              <button onClick={() => handleVote("DISLIKE")} aria-label="Dislike game" className={cn("flex items-center gap-1.5 rounded-md px-2.5 py-2 text-xs font-semibold transition", vote === "DISLIKE" ? "bg-rose-500/15 text-rose-300" : "text-zinc-500 hover:bg-white/5 hover:text-rose-300")}><ThumbsDown size={15} />{formatCompact(votes.dislikes)}</button>
            </div>
            <button onClick={save} className={cn("icon-button", saved && "border-violet-400/25 bg-violet-500/15 text-violet-300")} aria-label={saved ? "Remove from favorites" : "Add to favorites"} title={saved ? "Remove from favorites" : "Add to favorites"}>{saved ? <Check size={17} /> : <Bookmark size={17} />}</button>
            {playing && <button onClick={() => { setFrameKey((key) => key + 1); setLoading(true); setScore(null); }} className="icon-button hidden sm:inline-flex" aria-label="Restart game" title="Restart game"><RotateCcw size={16} /></button>}
            <button onClick={() => setTheater((value) => !value)} className={cn("icon-button hidden sm:inline-flex", theater && "border-violet-400/25 bg-violet-500/15 text-violet-300")} aria-label={theater ? "Exit theater mode" : "Theater mode"} title={theater ? "Exit theater mode" : "Theater mode"}>{theater ? <Minimize size={16} /> : <Expand size={16} />}</button>
            <button onClick={toggleFullscreen} className="icon-button" aria-label={fullscreen ? "Exit fullscreen" : "Enter fullscreen"} title={fullscreen ? "Exit fullscreen" : "Fullscreen"}>{fullscreen ? <Minimize size={17} /> : <Maximize size={17} />}</button>
            <button onClick={share} className="icon-button hidden md:inline-flex" aria-label="Share game" title="Share game"><Share2 size={16} /></button>
          </div>
        </div>
      </div>

      <div className="mt-9 grid gap-8 lg:grid-cols-[minmax(0,1fr)_320px]">
        <div>
          <div className="flex flex-wrap items-start justify-between gap-4">
            <div><p className="eyebrow">{game.category.name} · {game.developerName}</p><h2 className="mt-2 text-3xl font-black tracking-[-0.035em] text-white sm:text-4xl">{game.title}</h2><p className="mt-2 text-sm text-zinc-400">{game.tagline}</p></div>
            <div className="flex items-center gap-2 rounded-xl border border-amber-300/10 bg-amber-400/[0.05] px-3 py-2"><Star size={16} className="text-amber-300" fill="currentColor" /><span className="text-sm font-bold text-amber-200">{positive}%</span><span className="text-[11px] text-zinc-500">positive</span></div>
          </div>
          <div className="mt-5 flex flex-wrap gap-2">
            <Link href={`/category/${game.category.slug}`} className="rounded-lg border border-violet-400/15 bg-violet-500/10 px-3 py-1.5 text-xs font-semibold text-violet-300 hover:bg-violet-500/15">{game.category.name}</Link>
            {game.tags.map((tag) => <Link key={tag.id} href={`/tag/${tag.slug}`} className="rounded-lg border border-white/[0.07] bg-white/[0.025] px-3 py-1.5 text-xs font-semibold text-zinc-400 hover:border-white/15 hover:text-white">{tag.name}</Link>)}
          </div>

          <section className="mt-8"><h3 className="mb-3 text-lg font-bold text-white">About this game</h3><div className="markdown-body"><ReactMarkdown remarkPlugins={[remarkGfm]}>{game.description}</ReactMarkdown></div></section>
          {game.controlsGuide && <section className="mt-8"><h3 className="mb-3 text-lg font-bold text-white">Controls</h3><div className="rounded-xl border border-white/[0.07] bg-white/[0.025] p-5"><div className="markdown-body"><ReactMarkdown remarkPlugins={[remarkGfm]}>{game.controlsGuide}</ReactMarkdown></div></div></section>}
          {game.screenshots.length > 1 && <section className="mt-8"><h3 className="mb-3 text-lg font-bold text-white">Screenshots</h3><div className="grid gap-3 sm:grid-cols-2">{game.screenshots.map((screenshot, index) => <div key={`${screenshot}-${index}`} className="relative aspect-video overflow-hidden rounded-xl border border-white/[0.07]"><Image src={screenshot} alt={`${game.title} screenshot ${index + 1}`} fill sizes="(max-width: 768px) 100vw, 45vw" className="object-cover" /></div>)}</div></section>}

          <section className="mt-10 border-t border-white/[0.07] pt-8">
            <div className="flex items-center justify-between"><h3 className="flex items-center gap-2 text-lg font-bold text-white"><MessageCircle size={18} className="text-violet-300" />Comments <span className="text-sm font-normal text-zinc-600">{comments.length}</span></h3></div>
            {user ? (
              <form onSubmit={postComment} className="mt-5"><textarea value={commentBody} onChange={(event) => setCommentBody(event.target.value)} maxLength={1000} required rows={3} placeholder="Share your thoughts with the community..." className="portal-input resize-y" /><div className="mt-2 flex items-center justify-between"><span className="text-[11px] text-zinc-600">{commentBody.length}/1,000</span><button type="submit" disabled={submittingComment || !commentBody.trim()} className="primary-button px-4 py-2.5 text-xs disabled:opacity-50">{submittingComment ? <LoaderCircle size={14} className="animate-spin" /> : null}Post comment</button></div></form>
            ) : (
              <button onClick={() => openAuth("login")} className="mt-5 flex w-full items-center justify-center gap-2 rounded-xl border border-dashed border-white/10 bg-white/[0.02] px-4 py-5 text-sm text-zinc-500 transition hover:border-violet-400/25 hover:text-violet-300"><MessageCircle size={17} />Sign in to join the conversation</button>
            )}
            <div className="mt-6 space-y-4">
              {comments.map((comment) => (
                <article key={comment.id} className="flex gap-3 rounded-xl border border-white/[0.06] bg-white/[0.02] p-4">
                  <span className="grid size-9 shrink-0 place-items-center rounded-lg bg-gradient-to-br from-violet-400/80 to-indigo-600 text-xs font-black text-white">{comment.user.username.slice(0, 1).toUpperCase()}</span>
                  <div className="min-w-0 flex-1"><div className="flex flex-wrap items-center gap-2"><p className="text-sm font-bold text-zinc-200">{comment.user.username}</p>{comment.user.role === "ADMIN" && <span className="rounded bg-violet-500/15 px-1.5 py-0.5 text-[9px] font-black uppercase tracking-wider text-violet-300">Admin</span>}<time className="text-[11px] text-zinc-600">{formatDate(comment.createdAt)}</time></div><p className="mt-2 whitespace-pre-wrap break-words text-sm leading-6 text-zinc-400">{comment.body}</p></div>
                </article>
              ))}
              {!comments.length && <p className="py-6 text-center text-sm text-zinc-600">No comments yet. Be the first to share your thoughts.</p>}
            </div>
          </section>
        </div>

        <aside className="space-y-4">
          <div className="surface-card p-5"><h3 className="mb-4 text-sm font-bold text-white">Game details</h3><dl className="space-y-4 text-sm">
            <div className="flex items-center gap-3"><Building2 size={16} className="text-zinc-600" /><div><dt className="text-[11px] text-zinc-600">Developer</dt><dd className="mt-0.5 font-semibold text-zinc-300">{game.developerName}</dd></div></div>
            <div className="flex items-center gap-3"><CalendarDays size={16} className="text-zinc-600" /><div><dt className="text-[11px] text-zinc-600">Released</dt><dd className="mt-0.5 font-semibold text-zinc-300">{formatDate(game.publishedAt)}</dd></div></div>
            <div className="flex items-center gap-3"><Gamepad2 size={16} className="text-zinc-600" /><div><dt className="text-[11px] text-zinc-600">Category</dt><dd className="mt-0.5 font-semibold text-zinc-300">{game.category.name}</dd></div></div>
            <div className="flex items-center gap-3">{game.supportsMobile ? <Smartphone size={16} className="text-emerald-500" /> : <Monitor size={16} className="text-zinc-600" />}<div><dt className="text-[11px] text-zinc-600">Best played on</dt><dd className="mt-0.5 font-semibold text-zinc-300">{game.supportsMobile ? "Desktop & mobile" : "Desktop"}</dd></div></div>
            <div className="flex items-center gap-3"><Heart size={16} className="text-rose-400" /><div><dt className="text-[11px] text-zinc-600">Community rating</dt><dd className="mt-0.5 font-semibold text-zinc-300">{formatCompact(game.likesCount)} likes</dd></div></div>
          </dl></div>
          <div className="rounded-xl border border-violet-400/10 bg-gradient-to-br from-violet-500/10 to-transparent p-5"><p className="text-sm font-bold text-violet-200">Play together</p><p className="mt-2 text-xs leading-5 text-zinc-500">Challenge a friend to beat your score. Every run is a new chance to climb the leaderboard of your own life.</p><button onClick={share} className="secondary-button mt-4 w-full py-2.5 text-xs"><Share2 size={14} />Share this game</button></div>
        </aside>
      </div>

      {game.similarGames.length > 0 && <section className="mt-14 border-t border-white/[0.07] pt-9"><h2 className="mb-5 text-2xl font-bold tracking-tight text-white">You might also like</h2><GameGrid games={game.similarGames} /></section>}
    </div>
  );
}
