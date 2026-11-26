export const CONSENT_COOKIE = "nexus_consent";
export const PREFERENCES_COOKIE = "nexus_preferences";

const COOKIE_MAX_AGE = 60 * 60 * 24 * 180;
const LEGACY_SIDEBAR_KEY = "nexus:sidebar";

export interface CookieConsent {
  necessary: true;
  preferences: boolean;
  version: 1;
  updatedAt: string;
}

export interface PortalPreferences {
  sidebarCollapsed: boolean;
}

function readCookie(name: string): string | null {
  if (typeof document === "undefined") return null;
  const prefix = `${name}=`;
  const match = document.cookie.split("; ").find((item) => item.startsWith(prefix));
  if (!match) return null;
  try {
    return decodeURIComponent(match.slice(prefix.length));
  } catch {
    return null;
  }
}

function readJsonCookie<T>(name: string): T | null {
  const value = readCookie(name);
  if (!value) return null;
  try {
    const parsed: unknown = JSON.parse(value);
    return parsed && typeof parsed === "object" && !Array.isArray(parsed) ? parsed as T : null;
  } catch {
    return null;
  }
}

function writeCookie(name: string, value: string) {
  if (typeof document === "undefined") return;
  const attributes = [
    `${name}=${encodeURIComponent(value)}`,
    `Max-Age=${COOKIE_MAX_AGE}`,
    "Path=/",
    "SameSite=Lax",
  ];
  if (window.location.protocol === "https:") attributes.push("Secure");
  document.cookie = attributes.join("; ");
}

function removeCookie(name: string) {
  if (typeof document === "undefined") return;
  const attributes = [`${name}=`, "Max-Age=0", "Path=/", "SameSite=Lax"];
  if (window.location.protocol === "https:") attributes.push("Secure");
  document.cookie = attributes.join("; ");
}

function readLegacySidebar(): boolean {
  try {
    return localStorage.getItem(LEGACY_SIDEBAR_KEY) === "collapsed";
  } catch {
    return false;
  }
}

export function readCookieConsent(): CookieConsent | null {
  const consent = readJsonCookie<CookieConsent>(CONSENT_COOKIE);
  return consent?.version === 1 && consent.necessary === true && typeof consent.preferences === "boolean"
    ? consent
    : null;
}

export function writeCookieConsent(preferences: boolean) {
  const consent: CookieConsent = {
    necessary: true,
    preferences,
    version: 1,
    updatedAt: new Date().toISOString(),
  };
  writeCookie(CONSENT_COOKIE, JSON.stringify(consent));

  if (!preferences) {
    removeCookie(PREFERENCES_COOKIE);
    return;
  }

  if (!readPortalPreferences()) {
    writePortalPreferences({ sidebarCollapsed: readLegacySidebar() });
  }
}

export function readPortalPreferences(): PortalPreferences | null {
  const preferences = readJsonCookie<PortalPreferences>(PREFERENCES_COOKIE);
  return preferences && typeof preferences.sidebarCollapsed === "boolean" ? preferences : null;
}

export function writePortalPreferences(preferences: PortalPreferences) {
  writeCookie(PREFERENCES_COOKIE, JSON.stringify(preferences));
}

export function readSidebarCollapsed(): boolean {
  return readPortalPreferences()?.sidebarCollapsed ?? readLegacySidebar();
}

export function writeSidebarCollapsed(collapsed: boolean) {
  if (readCookieConsent()?.preferences) {
    const current = readPortalPreferences() ?? { sidebarCollapsed: collapsed };
    writePortalPreferences({ ...current, sidebarCollapsed: collapsed });
    return;
  }

  try {
    localStorage.setItem(LEGACY_SIDEBAR_KEY, collapsed ? "collapsed" : "expanded");
  } catch {
    return;
  }
}
