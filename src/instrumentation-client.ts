import * as Sentry from "@sentry/nextjs";

const DEFAULT_TRACES_SAMPLE_RATE = 0.1;
let sentryInitialized = false;

function readSampleRate(value: string | undefined, fallback: number): number {
  if (!value) return fallback;

  const rate = Number(value);
  return Number.isFinite(rate) && rate >= 0 && rate <= 1 ? rate : fallback;
}

function navigationTarget(url: string): string {
  try {
    const target = new URL(url, window.location.origin);
    return target.origin === window.location.origin
      ? target.pathname
      : `${target.origin}${target.pathname}`;
  } catch {
    return "[invalid URL]";
  }
}

const dsn = process.env.NEXT_PUBLIC_SENTRY_DSN?.trim();

if (dsn) {
  try {
    const environment =
      process.env.NEXT_PUBLIC_SENTRY_ENVIRONMENT?.trim() || undefined;
    const release = process.env.NEXT_PUBLIC_SENTRY_RELEASE?.trim() || undefined;
    const tracesSampleRate = readSampleRate(
      process.env.NEXT_PUBLIC_SENTRY_TRACES_SAMPLE_RATE,
      DEFAULT_TRACES_SAMPLE_RATE,
    );
    const replaySessionSampleRate = readSampleRate(
      process.env.NEXT_PUBLIC_SENTRY_REPLAYS_SESSION_SAMPLE_RATE,
      0,
    );
    const replayOnErrorSampleRate = readSampleRate(
      process.env.NEXT_PUBLIC_SENTRY_REPLAYS_ON_ERROR_SAMPLE_RATE,
      0,
    );
    const replayEnabled =
      process.env.NEXT_PUBLIC_SENTRY_ENABLE_REPLAY === "true" &&
      (replaySessionSampleRate > 0 || replayOnErrorSampleRate > 0);

    // Sentry 11 uses dataCollection; the spread keeps sendDefaultPii: false
    // explicit while remaining compatible with the installed SDK types.
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
      maxBreadcrumbs: 50,
      ...(environment ? { environment } : {}),
      ...(release ? { release } : {}),
      ...(replayEnabled
        ? {
            replaysSessionSampleRate: replaySessionSampleRate,
            replaysOnErrorSampleRate: replayOnErrorSampleRate,
            integrations: [
              Sentry.replayIntegration({
                maskAllText: true,
                blockAllMedia: true,
              }),
            ],
          }
        : {}),
    });
    sentryInitialized = true;
  } catch {
    // Browser monitoring must never block hydration or application startup.
  }
}

export function onRouterTransitionStart(
  url: string,
  navigationType: "push" | "replace" | "traverse",
) {
  if (!sentryInitialized) return;

  try {
    Sentry.addBreadcrumb({
      category: "navigation",
      message: `Router transition to ${navigationTarget(url)}`,
      level: "info",
      data: { navigation_type: navigationType },
    });
  } catch {
    // Breadcrumbs are best-effort and must not affect navigation.
  }
}
