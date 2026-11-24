import type { Metadata, Viewport } from "next";
import { AppProviders } from "@/components/providers";
import { SiteChrome } from "@/components/portal-shell";
import "./globals.css";

export const metadata: Metadata = {
  title: { default: "Nexus — Play something extraordinary", template: "%s | Nexus" },
  description: "Discover and play curated HTML5 games instantly. Build your favorites, compete with friends, and find your next obsession.",
  applicationName: "Nexus Play",
};

export const viewport: Viewport = {
  width: "device-width",
  initialScale: 1,
  themeColor: "#0c0d14",
};

export default function RootLayout({ children }: Readonly<{ children: React.ReactNode }>) {
  return (
    <html lang="en" className="h-full antialiased">
      <body className="min-h-full bg-[#0c0d14] text-zinc-100">
        <AppProviders>
          <SiteChrome>{children}</SiteChrome>
        </AppProviders>
      </body>
    </html>
  );
}
