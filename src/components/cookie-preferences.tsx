"use client";

import { createContext, useCallback, useContext, useEffect, useMemo, useRef, useState, type ReactNode } from "react";
import { Check, Cookie, ShieldCheck, SlidersHorizontal, X } from "lucide-react";
import { readCookieConsent, writeCookieConsent, type CookieConsent } from "@/lib/cookies";

interface CookiePreferencesContextValue {
  preferencesEnabled: boolean;
  openSettings: () => void;
}

const CookiePreferencesContext = createContext<CookiePreferencesContextValue | null>(null);

export function CookiePreferencesProvider({ children }: { children: ReactNode }) {
  const [consent, setConsent] = useState<CookieConsent | null>(null);
  const [ready, setReady] = useState(false);
  const [settingsOpen, setSettingsOpen] = useState(false);
  const [preferencesDraft, setPreferencesDraft] = useState(false);
  const closeRef = useRef<HTMLButtonElement>(null);

  useEffect(() => {
    const frame = window.requestAnimationFrame(() => {
      setConsent(readCookieConsent());
      setReady(true);
    });
    return () => window.cancelAnimationFrame(frame);
  }, []);

  useEffect(() => {
    if (!settingsOpen) return;
    closeRef.current?.focus();
    const previousOverflow = document.body.style.overflow;
    document.body.style.overflow = "hidden";
    const onKeyDown = (event: KeyboardEvent) => {
      if (event.key === "Escape") setSettingsOpen(false);
    };
    window.addEventListener("keydown", onKeyDown);
    return () => {
      document.body.style.overflow = previousOverflow;
      window.removeEventListener("keydown", onKeyDown);
    };
  }, [consent?.preferences, settingsOpen]);

  const saveConsent = useCallback((preferences: boolean) => {
    writeCookieConsent(preferences);
    setConsent(readCookieConsent());
    setSettingsOpen(false);
  }, []);

  const openSettings = useCallback(() => {
    setPreferencesDraft(consent?.preferences ?? false);
    setSettingsOpen(true);
  }, [consent?.preferences]);
  const value = useMemo<CookiePreferencesContextValue>(() => ({
    preferencesEnabled: consent?.preferences === true,
    openSettings,
  }), [consent?.preferences, openSettings]);

  return (
    <CookiePreferencesContext.Provider value={value}>
      {children}

      {ready && !consent && !settingsOpen && (
        <section aria-label="Cookie notice" className="fixed inset-x-4 bottom-4 z-[110] mx-auto max-w-3xl rounded-2xl border border-white/10 bg-[#141622]/95 p-5 shadow-2xl shadow-black/40 backdrop-blur-xl sm:p-6">
          <div className="flex items-start gap-4">
            <span className="grid size-11 shrink-0 place-items-center rounded-xl border border-violet-400/15 bg-violet-500/10 text-violet-300"><Cookie size={21} /></span>
            <div className="min-w-0 flex-1">
              <h2 className="text-lg font-bold text-white">Your play, your preferences</h2>
              <p className="mt-1.5 text-sm leading-6 text-zinc-400">We use an essential HTTP-only cookie for sign-in and security. With your permission, a preferences cookie remembers your sidebar layout. No advertising or third-party tracking cookies.</p>
            </div>
          </div>
          <div className="mt-5 flex flex-col gap-2 sm:flex-row sm:items-center">
            <button type="button" onClick={() => saveConsent(false)} className="secondary-button">Essential only</button>
            <button type="button" onClick={() => saveConsent(true)} className="primary-button"><Check size={16} />Allow preferences</button>
            <button type="button" onClick={openSettings} className="inline-flex items-center justify-center gap-2 rounded-lg px-3 py-2 text-sm font-semibold text-zinc-400 transition hover:bg-white/5 hover:text-white"><SlidersHorizontal size={15} />Customize</button>
          </div>
        </section>
      )}

      {settingsOpen && (
        <div className="fixed inset-0 z-[120] flex items-center justify-center overflow-y-auto bg-black/75 p-4 backdrop-blur-md" onMouseDown={(event) => { if (event.target === event.currentTarget) setSettingsOpen(false); }}>
          <div role="dialog" aria-modal="true" aria-labelledby="cookie-settings-title" className="relative my-auto w-full max-w-lg rounded-2xl border border-white/10 bg-[#141622] p-6 shadow-2xl shadow-violet-950/40 sm:p-8">
            <button ref={closeRef} type="button" onClick={() => setSettingsOpen(false)} aria-label="Close cookie settings" className="absolute right-4 top-4 rounded-lg p-2 text-zinc-500 transition hover:bg-white/5 hover:text-white"><X size={18} /></button>
            <div className="flex items-center gap-3">
              <span className="grid size-10 place-items-center rounded-xl bg-violet-500/10 text-violet-300"><Cookie size={20} /></span>
              <div><p className="eyebrow">Privacy controls</p><h2 id="cookie-settings-title" className="mt-1 text-xl font-bold text-white">Cookie preferences</h2></div>
            </div>

            <div className="mt-6 space-y-3">
              <div className="rounded-xl border border-white/[0.07] bg-white/[0.025] p-4">
                <div className="flex items-center justify-between gap-3">
                  <div className="flex items-center gap-2 font-semibold text-white"><ShieldCheck size={17} className="text-emerald-300" />Strictly necessary</div>
                  <span className="rounded-full bg-emerald-500/10 px-2.5 py-1 text-[10px] font-bold uppercase tracking-wider text-emerald-300">Always active</span>
                </div>
                <p className="mt-2 text-sm leading-6 text-zinc-500"><code className="text-zinc-300">portal_session</code> keeps you signed in and protects your account. It is HTTP-only, SameSite=Lax, and expires after 7 days.</p>
              </div>

              <label className="flex cursor-pointer items-start gap-3 rounded-xl border border-white/[0.07] bg-white/[0.025] p-4">
                <input type="checkbox" checked={preferencesDraft} onChange={(event) => setPreferencesDraft(event.target.checked)} className="mt-1 size-4 shrink-0 accent-violet-500" />
                <span>
                  <span className="flex items-center gap-2 font-semibold text-white"><SlidersHorizontal size={17} className="text-violet-300" />Preferences</span>
                  <span className="mt-2 block text-sm leading-6 text-zinc-500"><code className="text-zinc-300">nexus_preferences</code> remembers your sidebar layout for up to 180 days. It is only stored when you allow it.</span>
                </span>
              </label>
            </div>

            <p className="mt-4 text-xs leading-5 text-zinc-600"><code className="text-zinc-400">nexus_consent</code> stores this choice for up to 180 days. We do not use advertising or third-party tracking cookies.</p>
            <div className="mt-6 flex flex-col-reverse gap-2 sm:flex-row sm:justify-end">
              <button type="button" onClick={() => saveConsent(false)} className="secondary-button">Essential only</button>
              <button type="button" onClick={() => saveConsent(preferencesDraft)} className="primary-button"><Check size={16} />Save choices</button>
            </div>
          </div>
        </div>
      )}
    </CookiePreferencesContext.Provider>
  );
}

export function useCookiePreferences() {
  const context = useContext(CookiePreferencesContext);
  if (!context) throw new Error("useCookiePreferences must be used within CookiePreferencesProvider.");
  return context;
}
