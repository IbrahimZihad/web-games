import type { Metadata, Viewport } from "next";
import { AppProviders } from "@/components/providers";
import { SiteChrome } from "@/components/portal-shell";
import "./globals.css";

const appUrl = process.env.NEXT_PUBLIC_APP_URL?.trim() || "http://localhost:3000";
const description =
  "Discover and play curated HTML5 games instantly. Save favorites, compete with friends, and find your next obsession on Nexus Play.";
const socialImage = {
  url: "/og.png",
  width: 1200,
  height: 630,
  alt: "Nexus Play — instant browser gaming with five original games",
};

export const metadata: Metadata = {
  metadataBase: new URL(appUrl),
  title: { default: "Nexus — Play something extraordinary", template: "%s | Nexus" },
  description,
  applicationName: "Nexus Play",
  openGraph: {
    title: "Nexus Play — Play something extraordinary",
    description,
    url: "/",
    siteName: "Nexus Play",
    type: "website",
    locale: "en_US",
    images: [socialImage],
  },
  twitter: {
    card: "summary_large_image",
    title: "Nexus Play — Play something extraordinary",
    description,
    images: [socialImage],
  },
};

export const viewport: Viewport = {
  width: "device-width",
  initialScale: 1,
  themeColor: "#0c0d14",
};

export default function RootLayout({ children }: Readonly<{ children: React.ReactNode }>) {
  return (
    <html lang="en" className="h-full antialiased" data-scroll-behavior="smooth">
      <body className="min-h-full bg-[#0c0d14] text-zinc-100">
        <AppProviders>
          <SiteChrome>{children}</SiteChrome>
        </AppProviders>
      </body>
    </html>
  );
}
