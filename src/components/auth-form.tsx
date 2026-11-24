"use client";

import { useState, type FormEvent } from "react";
import { ArrowRight, Eye, EyeOff, LoaderCircle, ShieldCheck, Sparkles } from "lucide-react";
import { useApp } from "@/components/providers";
import type { SessionUser } from "@/lib/types";

interface AuthFormProps {
  initialMode?: "login" | "register";
  returnPath?: string;
  onSuccess?: (user: SessionUser) => void;
}

export function AuthForm({ initialMode = "login", returnPath = "/", onSuccess }: AuthFormProps) {
  const { login, register } = useApp();
  const [mode, setMode] = useState(initialMode);
  const [username, setUsername] = useState("");
  const [email, setEmail] = useState("");
  const [password, setPassword] = useState("");
  const [showPassword, setShowPassword] = useState(false);
  const [submitting, setSubmitting] = useState(false);
  const [error, setError] = useState("");

  async function submit(event: FormEvent<HTMLFormElement>) {
    event.preventDefault();
    setSubmitting(true);
    setError("");
    try {
      const user = mode === "login" ? await login(email, password) : await register(username, email, password);
      if (onSuccess) onSuccess(user);
      else window.location.assign(returnPath.startsWith("/") ? returnPath : "/");
    } catch (caught) {
      setError(caught instanceof Error ? caught.message : "Something went wrong. Please try again.");
    } finally {
      setSubmitting(false);
    }
  }

  function fillDemo(kind: "player" | "admin") {
    setMode("login");
    setEmail(kind === "admin" ? "admin@gameportal.local" : "player@gameportal.local");
    setPassword(kind === "admin" ? "Admin@12345" : "Player@12345");
    setError("");
  }

  return (
    <div className="w-full">
      <div className="mb-7 flex rounded-xl border border-white/[0.07] bg-black/20 p-1">
        {(["login", "register"] as const).map((item) => (
          <button
            key={item}
            type="button"
            onClick={() => { setMode(item); setError(""); }}
            className={`flex-1 rounded-lg px-4 py-2.5 text-sm font-semibold transition ${mode === item ? "bg-white/[0.09] text-white shadow-sm" : "text-zinc-500 hover:text-zinc-300"}`}
          >
            {item === "login" ? "Sign in" : "Create account"}
          </button>
        ))}
      </div>

      <div className="mb-6">
        <p className="mb-2 flex items-center gap-2 text-xs font-bold uppercase tracking-[0.18em] text-violet-300">
          <Sparkles size={14} /> {mode === "login" ? "Welcome back" : "Join the community"}
        </p>
        <h2 className="text-2xl font-bold tracking-tight text-white">{mode === "login" ? "Your next game is waiting." : "Create your player profile."}</h2>
        <p className="mt-2 text-sm leading-6 text-zinc-400">
          {mode === "login" ? "Sign in to sync favorites, history, ratings, and comments." : "Save your progress across devices and join the conversation."}
        </p>
      </div>

      <form onSubmit={submit} className="space-y-4">
        {mode === "register" && (
          <label className="block">
            <span className="mb-2 block text-xs font-semibold text-zinc-300">Username</span>
            <input
              value={username}
              onChange={(event) => setUsername(event.target.value)}
              autoComplete="username"
              required
              minLength={3}
              maxLength={50}
              placeholder="Your player name"
              className="portal-input"
            />
          </label>
        )}
        <label className="block">
          <span className="mb-2 block text-xs font-semibold text-zinc-300">Email address</span>
          <input
            type="email"
            value={email}
            onChange={(event) => setEmail(event.target.value)}
            autoComplete="email"
            required
            placeholder="you@example.com"
            className="portal-input"
          />
        </label>
        <label className="block">
          <span className="mb-2 block text-xs font-semibold text-zinc-300">Password</span>
          <span className="relative block">
            <input
              type={showPassword ? "text" : "password"}
              value={password}
              onChange={(event) => setPassword(event.target.value)}
              autoComplete={mode === "login" ? "current-password" : "new-password"}
              required
              minLength={mode === "register" ? 8 : 1}
              maxLength={128}
              placeholder={mode === "register" ? "At least 8 characters" : "Your password"}
              className="portal-input pr-12"
            />
            <button
              type="button"
              onClick={() => setShowPassword((value) => !value)}
              aria-label={showPassword ? "Hide password" : "Show password"}
              className="absolute right-3 top-1/2 -translate-y-1/2 rounded-md p-1.5 text-zinc-500 hover:bg-white/5 hover:text-white"
            >
              {showPassword ? <EyeOff size={17} /> : <Eye size={17} />}
            </button>
          </span>
        </label>

        {error && <p role="alert" className="rounded-lg border border-rose-400/20 bg-rose-400/[0.07] px-3 py-2.5 text-sm text-rose-200">{error}</p>}

        <button type="submit" disabled={submitting} className="primary-button w-full justify-center py-3.5 disabled:opacity-60">
          {submitting ? <LoaderCircle size={18} className="animate-spin" /> : null}
          {mode === "login" ? "Sign in to Nexus" : "Create my account"}
          {!submitting && <ArrowRight size={17} />}
        </button>
      </form>

      <div className="mt-6 rounded-xl border border-white/[0.06] bg-white/[0.025] p-3.5">
        <p className="mb-2.5 flex items-center gap-2 text-[11px] font-bold uppercase tracking-wider text-zinc-500"><ShieldCheck size={13} /> Demo access</p>
        <div className="flex flex-wrap gap-2">
          <button type="button" onClick={() => fillDemo("player")} className="secondary-button px-3 py-2 text-xs">Player demo</button>
          <button type="button" onClick={() => fillDemo("admin")} className="secondary-button px-3 py-2 text-xs">Admin demo</button>
        </div>
        <p className="mt-2.5 text-[11px] leading-5 text-zinc-600">Credentials are filled in for you. Select a demo, then sign in.</p>
      </div>
    </div>
  );
}
