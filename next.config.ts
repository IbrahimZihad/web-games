import { withSentryConfig } from "@sentry/nextjs/config";
import type { NextConfig } from "next";

const securityHeaders = [
  { key: "X-Content-Type-Options", value: "nosniff" },
  { key: "X-Frame-Options", value: "SAMEORIGIN" },
  { key: "Referrer-Policy", value: "strict-origin-when-cross-origin" },
  { key: "Permissions-Policy", value: "camera=(), microphone=(), geolocation=()" },
];

const nextConfig: NextConfig = {
  poweredByHeader: false,
  images: {
    dangerouslyAllowSVG: true,
    contentDispositionType: "attachment",
    contentSecurityPolicy: "default-src 'self'; script-src 'none'; sandbox;",
  },
  async headers() {
    return [
      {
        source: "/:path*",
        headers: securityHeaders,
      },
      {
        source: "/uploads/games/:path*",
        // Sandboxed module cartridges run with an opaque "null" origin.
        headers: [
          { key: "Access-Control-Allow-Origin", value: "null" },
          { key: "Cross-Origin-Opener-Policy", value: "same-origin" },
          { key: "Cross-Origin-Embedder-Policy", value: "require-corp" },
          { key: "Cross-Origin-Resource-Policy", value: "cross-origin" },
          { key: "X-Robots-Tag", value: "noindex, nofollow" },
          { key: "Cache-Control", value: "public, max-age=3600" },
        ],
      },
      {
        source: "/api/:path*",
        headers: [{ key: "X-Robots-Tag", value: "noindex, nofollow" }],
      },
    ];
  },
};

function envValue(name: string): string | undefined {
  const value = process.env[name]?.trim();
  return value ? value : undefined;
}

function envFlag(name: string): boolean {
  return envValue(name)?.toLowerCase() === "true";
}

const buildDebug = envFlag("SENTRY_BUILD_DEBUG");
const sentryOrg = envValue("SENTRY_ORG");
const sentryProject = envValue("SENTRY_PROJECT");
const sentryAuthToken = envValue("SENTRY_AUTH_TOKEN");
const sentryRelease = envValue("SENTRY_RELEASE");
const uploadSourceMaps =
  envFlag("SENTRY_SOURCEMAPS_UPLOAD") &&
  Boolean(sentryOrg && sentryProject && sentryAuthToken);

export default withSentryConfig(nextConfig, {
  org: sentryOrg,
  project: sentryProject,
  ...(uploadSourceMaps ? { authToken: sentryAuthToken } : {}),
  telemetry: false,
  silent: !buildDebug,
  widenClientFileUpload: false,
  sourcemaps: {
    upload: uploadSourceMaps,
    disable: uploadSourceMaps ? false : "disable-upload",
    deleteSourcemapsAfterUpload:
      uploadSourceMaps && envValue("SENTRY_SOURCEMAPS_DELETE") !== "false",
    assets: [
      ".next/static/**/*.js",
      ".next/static/**/*.map",
      ".next/server/**/*.js",
      ".next/server/**/*.map",
    ],
  },
  release: {
    name: sentryRelease,
    create: uploadSourceMaps,
    finalize: uploadSourceMaps,
    inject: Boolean(sentryRelease),
  },
  errorHandler(error) {
    if (buildDebug) {
      console.warn("[Sentry] Build-time monitoring error:", error.message);
    }
  },
});
