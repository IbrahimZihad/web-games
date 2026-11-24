import { AuthError, requireAdmin } from "@/lib/auth";
import { checkRateLimit } from "@/lib/rate-limit";
import { extractGameZip, ZipError } from "@/lib/zip";

export const runtime = "nodejs";
export const maxDuration = 300;

const MAX_BUNDLE_BYTES = 250 * 1024 * 1024;
const MULTIPART_OVERHEAD_BYTES = 1024 * 1024;
const SLUG_PATTERN = /^[a-z0-9]+(?:-[a-z0-9]+)*$/;
const ZIP_MIME_TYPES = new Set([
  "application/zip",
  "application/x-zip-compressed",
  "application/octet-stream",
]);

class HttpError extends Error {
  constructor(message: string, readonly status: number) {
    super(message);
    this.name = "HttpError";
  }
}

function getClientIp(request: Request): string {
  const forwarded = request.headers.get("x-forwarded-for")?.split(",")[0]?.trim();
  return forwarded || request.headers.get("x-real-ip")?.trim() || "local";
}

function createBoundedRequest(request: Request, maxBytes: number): Request {
  const contentLength = request.headers.get("content-length");
  if (contentLength !== null) {
    if (!/^\d+$/.test(contentLength)) {
      throw new HttpError("Invalid content length.", 400);
    }
    if (Number(contentLength) > maxBytes) {
      throw new HttpError("The upload is too large.", 413);
    }
  }

  if (!request.body) {
    throw new HttpError("A multipart upload is required.", 400);
  }

  let received = 0;
  const body = request.body.pipeThrough(new TransformStream<Uint8Array, Uint8Array>({
    transform(chunk, controller) {
      received += chunk.byteLength;
      if (received > maxBytes) {
        controller.error(new HttpError("The upload is too large.", 413));
        return;
      }
      controller.enqueue(chunk);
    },
  }));

  const init: RequestInit & { duplex: "half" } = {
    method: request.method,
    headers: request.headers,
    body,
    signal: request.signal,
    duplex: "half",
  };
  return new Request(request.url, init);
}

async function readMultipartForm(request: Request): Promise<FormData> {
  const contentType = request.headers.get("content-type")?.trim() ?? "";
  if (!/^multipart\/form-data(?:\s*;|$)/i.test(contentType)) {
    throw new HttpError("Multipart form data is required.", 415);
  }

  try {
    const boundedRequest = createBoundedRequest(
      request,
      MAX_BUNDLE_BYTES + MULTIPART_OVERHEAD_BYTES,
    );
    return await boundedRequest.formData();
  } catch (error) {
    if (error instanceof HttpError) {
      throw error;
    }
    throw new HttpError("Invalid multipart form data.", 400);
  }
}

function validateBundle(file: File): void {
  if (file.size === 0) {
    throw new HttpError("The game bundle is empty.", 400);
  }
  if (file.size > MAX_BUNDLE_BYTES) {
    throw new HttpError("The game bundle exceeds the 250MB limit.", 413);
  }
  if (!ZIP_MIME_TYPES.has(file.type.toLowerCase())) {
    throw new HttpError("The game bundle must be a ZIP file.", 415);
  }
  if (!file.name.toLowerCase().endsWith(".zip")) {
    throw new HttpError("The game bundle must have a .zip filename.", 400);
  }
}

function errorResponse(error: unknown): Response {
  if (error instanceof AuthError) {
    const message = error.status === 403
      ? "Administrator access required."
      : "Please sign in to continue.";
    return Response.json({ error: message }, { status: error.status });
  }
  if (error instanceof HttpError) {
    return Response.json({ error: error.message }, { status: error.status });
  }
  if (error instanceof ZipError) {
    return Response.json({ error: error.message }, { status: error.status });
  }
  return Response.json({ error: "The game build could not be uploaded." }, { status: 500 });
}

export async function POST(request: Request): Promise<Response> {
  try {
    await requireAdmin();

    const rateLimit = checkRateLimit(`game-build:${getClientIp(request)}`, 5, 60 * 60 * 1000);
    if (!rateLimit.allowed) {
      return Response.json(
        { error: "Too many game build uploads. Please try again later." },
        { status: 429, headers: { "Retry-After": String(rateLimit.retryAfter) } },
      );
    }

    const formData = await readMultipartForm(request);
    if (formData.getAll("slug").length !== 1 || formData.getAll("bundle").length !== 1) {
      throw new HttpError("A slug and game bundle are required.", 400);
    }

    const slug = formData.get("slug");
    const bundle = formData.get("bundle");
    if (typeof slug !== "string" || slug.length > 120 || !SLUG_PATTERN.test(slug)) {
      throw new HttpError("Invalid game slug.", 400);
    }
    if (!(bundle instanceof File)) {
      throw new HttpError("A ZIP game bundle is required.", 400);
    }

    validateBundle(bundle);
    const buffer = Buffer.from(await bundle.arrayBuffer());
    if (buffer.length !== bundle.size || buffer.length > MAX_BUNDLE_BYTES) {
      throw new HttpError("The game bundle exceeds the 250MB limit.", 413);
    }

    const embedUrl = await extractGameZip(buffer, slug);
    return Response.json({ embedUrl }, { status: 201 });
  } catch (error) {
    return errorResponse(error);
  }
}
