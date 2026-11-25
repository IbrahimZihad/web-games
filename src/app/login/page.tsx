import Image from "next/image";
import { redirect } from "next/navigation";
import { Gamepad2, ShieldCheck, Sparkles, Zap } from "lucide-react";
import { AuthForm } from "@/components/auth-form";
import { getCurrentUser } from "@/lib/auth";
import { buildMetadata } from "@/lib/seo";

export const dynamic = "force-dynamic";

export const metadata = buildMetadata({
  title: "Sign in to Nexus Play",
  description: "Sign in to sync your favorite browser games, play history, ratings, and comments across devices.",
  path: "/login",
  keywords: ["Nexus Play sign in", "player account", "sync game favorites"],
  noindex: true,
});

export default async function LoginPage({ searchParams }: { searchParams: Promise<{ next?: string }> }) {
  const [{ next = "/" }, user] = await Promise.all([searchParams, getCurrentUser()]);
  if (user) redirect(user.role === "ADMIN" && next.startsWith("/admin") ? next : "/");
  const safeNext = next.startsWith("/") && !next.startsWith("//") ? next : "/";

  return (
    <main className="grid min-h-screen lg:grid-cols-[1.05fr_0.95fr]">
      <section className="relative hidden overflow-hidden border-r border-white/[0.07] lg:block">
        <Image src="/images/games/cyber-runner.svg" alt="Cyber Runner key art" fill priority sizes="55vw" className="object-cover" />
        <div className="absolute inset-0 bg-gradient-to-t from-[#090a11] via-[#090a11]/55 to-[#090a11]/10" />
        <div className="portal-grid absolute inset-0 opacity-40" />
        <div className="relative flex h-full flex-col justify-between p-12 xl:p-16">
          <div className="flex items-center gap-3"><span className="grid size-11 place-items-center rounded-xl bg-violet-500 shadow-lg shadow-violet-950/50"><Gamepad2 size={24} /></span><span className="text-xl font-black tracking-[0.16em] text-white">NEXUS<span className="text-violet-400">.</span></span></div>
          <div className="max-w-xl"><p className="eyebrow flex items-center gap-2"><Sparkles size={14} />Your next obsession starts here</p><h1 className="mt-4 text-5xl font-black leading-[1.02] tracking-[-0.045em] text-white xl:text-6xl">One account.<br />Every game you love.</h1><p className="mt-5 max-w-md text-base leading-7 text-zinc-400">Keep your favorites close, track your play history, and pick up any conversation. No downloads required.</p><div className="mt-8 flex flex-wrap gap-5 text-xs font-semibold text-zinc-400"><span className="flex items-center gap-2"><Zap size={15} className="text-violet-300" />Instant play</span><span className="flex items-center gap-2"><BookmarkIcon />Synced library</span><span className="flex items-center gap-2"><ShieldCheck size={15} className="text-emerald-300" />Secure sessions</span></div></div>
          <p className="text-xs text-zinc-600">Curated HTML5 games. Built for the browser.</p>
        </div>
      </section>
      <section className="flex min-h-screen items-center justify-center bg-[#10111b] px-5 py-10 sm:px-10">
        <div className="w-full max-w-[440px]"><AuthForm returnPath={safeNext} /></div>
      </section>
    </main>
  );
}

function BookmarkIcon() {
  return <svg width="15" height="15" viewBox="0 0 24 24" fill="none" stroke="currentColor" strokeWidth="2" aria-hidden="true"><path d="M19 21l-7-5-7 5V5a2 2 0 0 1 2-2h10a2 2 0 0 1 2 2z" /></svg>;
}
