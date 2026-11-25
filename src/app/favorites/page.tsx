import { Bookmark } from "lucide-react";
import { LibraryGrid } from "@/components/library-grid";
import { buildMetadata } from "@/lib/seo";

export const metadata = buildMetadata({
  title: "Your Favorite Browser Games",
  description: "View your personal shortlist of favorite HTML5 browser games on Nexus Play.",
  path: "/favorites",
  keywords: ["favorite browser games", "saved HTML5 games", "personal game library"],
  noindex: true,
});

export default function FavoritesPage() {
  return (
    <div>
      <div className="rounded-2xl border border-white/[0.07] bg-gradient-to-br from-[#181927] to-[#11121b] px-6 py-9 sm:px-9"><p className="eyebrow flex items-center gap-2"><Bookmark size={13} />Your library</p><h1 className="mt-2 text-3xl font-black tracking-tight text-white sm:text-4xl">Favorite games</h1><p className="mt-3 max-w-2xl text-sm leading-6 text-zinc-400">Your personal shortlist. Guest favorites stay on this device and sync when you create an account.</p></div>
      <div className="mt-8"><LibraryGrid type="favorites" /></div>
    </div>
  );
}
