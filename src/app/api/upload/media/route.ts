import path from "node:path";
import { AuthError, requireAdmin } from "@/lib/auth";
import { checkRateLimit, getClientKey } from "@/lib/rate-limit";
import { storageService } from "@/lib/storage";

export const runtime = "nodejs";
export const maxDuration = 120;

const MAX_MEDIA_BYTES = 100 * 1024 * 1024;
const MULTIPART_OVERHEAD_BYTES = 1024 * 1024;

type MediaPolicy = {
  extensions: readonly string[];
  maxBytes: number;
};

const MEDIA_POLICIES = new Map<string, MediaPolicy>([
  ["image/webp", { extensions: [".webp"], maxBytes: 10 * 1024 * 1024 }],
  ["image/png", { extensions: [".png"], maxBytes: 10 * 1024 * 1024 }],
  ["image/jpeg", { extensions: [".jpg", ".jpeg"], maxBytes: 10 * 1024 * 1024 }],
  ["video/mp4", { extensions: [".mp4"], maxBytes: MAX_MEDIA_BYTES }],
  ["video/webm", { extensions: [".webm"], maxBytes: MAX_MEDIA_BYTES }],
]);

class HttpError extends Error {
  constructor(message: string, readonly status: number) {
    super(message);
    this.name = "HttpError";
  }
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
    const boundedRequest = createBoundedRequest(request, MAX_MEDIA_BYTES + MULTIPART_OVERHEAD_BYTES);
    return await boundedRequest.formData();
  } catch (error) {
    if (error instanceof HttpError) {
      throw error;
    }
    throw new HttpError("Invalid multipart form data.", 400);
  }
}

function validateMedia(file: File): void {
  if (file.size === 0) {
    throw new HttpError("The media file is empty.", 400);
  }

  const policy = MEDIA_POLICIES.get(file.type.toLowerCase());
  if (!policy) {
    throw new HttpError("Unsupported media type.", 415);
  }
  if (file.size > policy.maxBytes) {
    throw new HttpError("The media file exceeds the allowed size.", 413);
  }

  const extension = path.extname(file.name).toLowerCase();
  if (!policy.extensions.includes(extension)) {
    throw new HttpError("The media extension does not match its MIME type.", 400);
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
  return Response.json({ error: "The media file could not be uploaded." }, { status: 500 });
}

export async function POST(request: Request): Promise<Response> {
  try {
    const admin = await requireAdmin();

    const rateLimit = await checkRateLimit(getClientKey(request, "media", `user:${admin.id}`), 30, 60 * 60 * 1000);
    if (!rateLimit.allowed) {
      return Response.json(
        { error: "Too many media uploads. Please try again later." },
        { status: 429, headers: { "Retry-After": String(rateLimit.retryAfter) } },
      );
    }

    const formData = await readMultipartForm(request);
    const candidates = [...formData.getAll("file"), ...formData.getAll("media")];
    const file = candidates[0];
    if (candidates.length !== 1 || !(file instanceof File)) {
      throw new HttpError("One media file is required.", 400);
    }

    validateMedia(file);
    const { url } = await storageService.save(file);
    return Response.json({ url }, { status: 201 });
  } catch (error) {
    return errorResponse(error);
  }
}
