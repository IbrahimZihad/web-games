import {
  ParentBasedSampler,
  TraceIdRatioBasedSampler,
} from "@opentelemetry/sdk-trace-base";
import { registerOTel, type Configuration } from "@vercel/otel";

const DEFAULT_TRACES_SAMPLE_RATE = 0.1;
const SUPPORTED_SAMPLERS = new Set([
  "always_on",
  "always_off",
  "parentbased_always_on",
  "parentbased_always_off",
  "traceidratio",
  "parentbased_traceidratio",
]);

let registered = false;

function readEnv(name: string): string | undefined {
  const value = process.env[name]?.trim();
  return value ? value : undefined;
}

function readSampleRate(value: string | undefined, fallback: number): number {
  if (!value) return fallback;

  const rate = Number(value);
  return Number.isFinite(rate) && rate >= 0 && rate <= 1 ? rate : fallback;
}

function getTraceSampler(): Configuration["traceSampler"] {
  const configuredSampler = readEnv("OTEL_TRACES_SAMPLER");
  if (configuredSampler && SUPPORTED_SAMPLERS.has(configuredSampler)) {
    return configuredSampler as Configuration["traceSampler"];
  }

  return new ParentBasedSampler({
    root: new TraceIdRatioBasedSampler(
      readSampleRate(
        readEnv("OTEL_TRACES_SAMPLER_ARG"),
        DEFAULT_TRACES_SAMPLE_RATE,
      ),
    ),
  });
}

function hasOtlpConfiguration(): boolean {
  return Boolean(
    readEnv("OTEL_EXPORTER_OTLP_TRACES_ENDPOINT") ||
      readEnv("OTEL_EXPORTER_OTLP_ENDPOINT") ||
      readEnv("VERCEL_OTEL_ENDPOINTS") ||
      readEnv("VERCEL_OTEL_SOCKET_PATH"),
  );
}

/**
 * Registers OpenTelemetry before a native Node service creates its HTTP server.
 * OTLP HTTP URLs, headers, service name, and sampler can be configured with
 * the standard OTEL_* environment variables. Without an exporter configuration
 * this is a no-op, so local startup never depends on a running collector.
 */
export function registerServiceTelemetry(serviceName: string): void {
  const normalizedServiceName = serviceName.trim();
  if (
    !normalizedServiceName ||
    registered ||
    readEnv("OTEL_SDK_DISABLED")?.toLowerCase() === "true" ||
    !hasOtlpConfiguration()
  ) {
    return;
  }

  registered = true;

  try {
    const environment =
      readEnv("SENTRY_ENVIRONMENT") || readEnv("NODE_ENV") || "development";
    const release = readEnv("SENTRY_RELEASE");

    registerOTel({
      serviceName: normalizedServiceName,
      attributes: {
        "deployment.environment.name": environment,
        ...(release ? { "service.version": release } : {}),
      },
      traceSampler: getTraceSampler(),
    });
  } catch {
    // Monitoring must never prevent a native service from starting.
  }
}
