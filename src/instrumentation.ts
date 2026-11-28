import * as Sentry from "@sentry/nextjs";
import { registerOTel } from "@vercel/otel";
import type { Instrumentation } from "next";

const DEFAULT_TRACES_SAMPLE_RATE = 0.1;
let sentryInitialized = false;

function readEnv(name: string): string | undefined {
  const value = process.env[name]?.trim();
  return value ? value : undefined;
}

function readSampleRate(value: string | undefined, fallback: number): number {
  if (!value) return fallback;

  const rate = Number(value);
  return Number.isFinite(rate) && rate >= 0 && rate <= 1 ? rate : fallback;
}

export function register() {
  if (process.env.NEXT_RUNTIME === "nodejs") {
    try {
      registerOTel({ serviceName: "nexus-play-web" });
    } catch {
      // OpenTelemetry is optional and must not block the Next.js server.
    }
  }

  const dsn =
    readEnv("NEXT_PUBLIC_SENTRY_DSN") || readEnv("SENTRY_DSN");
  if (!dsn) return;

  const environment =
    readEnv("SENTRY_ENVIRONMENT") ||
    readEnv("NEXT_PUBLIC_SENTRY_ENVIRONMENT") ||
    readEnv("NODE_ENV");
  const release =
    readEnv("SENTRY_RELEASE") || readEnv("NEXT_PUBLIC_SENTRY_RELEASE");
  const tracesSampleRate = readSampleRate(
    readEnv("SENTRY_TRACES_SAMPLE_RATE") ||
      readEnv("NEXT_PUBLIC_SENTRY_TRACES_SAMPLE_RATE"),
    DEFAULT_TRACES_SAMPLE_RATE,
  );

  try {
    // Sentry 11 uses dataCollection; retain sendDefaultPii for compatibility
    // with older SDK option handling without collecting request PII.
    const privacyOptions = {
      sendDefaultPii: false,
      dataCollection: {
        userInfo: false,
        cookies: false,
        httpHeaders: false,
        httpBodies: [],
        urlQueryParams: false,
        stackFrameVariables: false,
      },
    };

    Sentry.init({
      dsn,
      ...privacyOptions,
      tracesSampleRate,
      ...(environment ? { environment } : {}),
      ...(release ? { release } : {}),
      // Keep the @vercel/otel provider installed on Node. Sentry still captures
      // errors and its own spans, while Next.js spans flow to the OTLP collector.
      ...(process.env.NEXT_RUNTIME === "nodejs"
        ? { enableOpenTelemetrySetup: false }
        : {}),
    });
    sentryInitialized = true;
  } catch {
    // Error reporting is optional and must not block application startup.
  }
}

export const onRequestError: Instrumentation.onRequestError = (
  error,
  request,
  context,
) => {
  if (!sentryInitialized) return;

  try {
    Sentry.captureRequestError(
      error,
      {
        path: request.path,
        method: request.method,
        // Never forward cookies, authorization headers, or raw request headers.
        headers: {},
      },
      {
        routerKind: context.routerKind,
        routePath: context.routePath,
        routeType: context.routeType,
      },
    );
  } catch {
    // Instrumentation hooks must not interfere with error handling.
  }
};
