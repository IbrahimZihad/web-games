import Link from "next/link";
import { Gamepad2, Home } from "lucide-react";

export default function NotFound() {
  return (
    <div className="flex min-h-[65vh] flex-col items-center justify-center text-center">
      <span className="grid size-20 place-items-center rounded-3xl border border-violet-400/15 bg-violet-500/10 text-violet-300"><Gamepad2 size={34} /></span>
      <p className="eyebrow mt-7">404 · Game over</p>
      <h1 className="mt-3 text-3xl font-black tracking-tight text-white sm:text-4xl">This page wandered off the map.</h1>
      <p className="mt-3 max-w-md text-sm leading-6 text-zinc-500">The game or page you are looking for is not available. There are plenty more waiting in the arcade.</p>
      <Link href="/" className="primary-button mt-7"><Home size={16} />Back to Nexus</Link>
    </div>
  );
}
