"use client";

import { useEffect, useRef } from "react";
import { X } from "lucide-react";
import { AuthForm } from "@/components/auth-form";
import { useApp } from "@/components/providers";

export function AuthDialog() {
  const { authMode, closeAuth } = useApp();
  const closeRef = useRef<HTMLButtonElement>(null);

  useEffect(() => {
    if (!authMode) return;
    closeRef.current?.focus();
    const previous = document.body.style.overflow;
    document.body.style.overflow = "hidden";
    const onKeyDown = (event: KeyboardEvent) => {
      if (event.key === "Escape") closeAuth();
    };
    window.addEventListener("keydown", onKeyDown);
    return () => {
      document.body.style.overflow = previous;
      window.removeEventListener("keydown", onKeyDown);
    };
  }, [authMode, closeAuth]);

  if (!authMode) return null;

  return (
    <div className="fixed inset-0 z-[100] flex items-center justify-center overflow-y-auto bg-black/75 p-4 backdrop-blur-md" onMouseDown={(event) => { if (event.target === event.currentTarget) closeAuth(); }}>
      <div role="dialog" aria-modal="true" aria-labelledby="auth-dialog-title" className="relative my-auto w-full max-w-[460px] rounded-2xl border border-white/10 bg-[#141622] p-6 shadow-2xl shadow-violet-950/40 sm:p-8">
        <button ref={closeRef} type="button" onClick={closeAuth} aria-label="Close sign in dialog" className="absolute right-4 top-4 rounded-lg p-2 text-zinc-500 transition hover:bg-white/5 hover:text-white"><X size={18} /></button>
        <h1 id="auth-dialog-title" className="sr-only">{authMode === "login" ? "Sign in" : "Create account"}</h1>
        <AuthForm initialMode={authMode} onSuccess={closeAuth} />
      </div>
    </div>
  );
}
