import { Clock3 } from "lucide-react";
import { LibraryGrid } from "@/components/library-grid";
import { buildMetadata } from "@/lib/seo";

export const metadata = buildMetadata({
  title: "Your Recently Played Games",
  description: "Return to the HTML5 browser games you played most recently on Nexus Play.",
  path: "/recently-played",
  keywords: ["recently played games", "browser game history", "continue playing HTML5 games"],
  noindex: true,
});

export default function RecentlyPlayedPage() {
  return (
    <div>
      <div className="rounded-2xl border border-white/[0.07] bg-gradient-to-br from-[#181927] to-[#11121b] px-6 py-9 sm:px-9"><p className="eyebrow flex items-center gap-2"><Clock3 size={13} />Your library</p><h1 className="mt-2 text-3xl font-black tracking-tight text-white sm:text-4xl">Recently played</h1><p className="mt-3 max-w-2xl text-sm leading-6 text-zinc-400">Your latest games, automatically saved in this browser and synced to your account when you sign in.</p></div>
      <div className="mt-8"><LibraryGrid type="history" /></div>
    </div>
  );
}
