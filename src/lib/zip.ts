import { createHash, randomUUID } from "node:crypto";
import { createWriteStream } from "node:fs";
import { lstat, mkdir, mkdtemp, realpath, rename, rm } from "node:fs/promises";
import path from "node:path";
import { Transform } from "node:stream";
import { pipeline } from "node:stream/promises";
import { fromBufferPromise, type Entry, type ZipFile } from "yauzl";
import { prisma } from "@/lib/prisma";

const MAX_ENTRIES = 10_000;
const MAX_UNCOMPRESSED_BYTES = 750 * 1024 * 1024;
const MAX_COMPRESSION_RATIO = 200;
const SLUG_PATTERN = /^[a-z0-9]+(?:-[a-z0-9]+)*$/;
const DANGEROUS_EXTENSIONS = [".exe", ".sh", ".php", ".bat", ".cmd", ".com", ".msi"];
const WINDOWS_RESERVED_NAMES = new Set([
  "con", "prn", "aux", "nul",
  "com1", "com2", "com3", "com4", "com5", "com6", "com7", "com8", "com9",
  "lpt1", "lpt2", "lpt3", "lpt4", "lpt5", "lpt6", "lpt7", "lpt8", "lpt9",
]);

export class ZipError extends Error {
  readonly status: 400 | 500;

  constructor(message: string, status: 400 | 500 = 400) {
    super(message);
    this.name = "ZipError";
    this.status = status;
  }
}

function hasErrorCode(error: unknown, code: string): boolean {
  return typeof error === "object" && error !== null && "code" in error &&
    (error as { code?: unknown }).code === code;
}

function isInside(root: string, target: string): boolean {
  const relative = path.relative(root, target);
  return relative !== "" && relative !== ".." && !relative.startsWith(`..${path.sep}`) &&
    !path.isAbsolute(relative);
}

function isInsideOrEqual(root: string, target: string): boolean {
  return root === target || isInside(root, target);
}

function validateSlug(slug: string): void {
  if (slug.length > 120 || !SLUG_PATTERN.test(slug) || WINDOWS_RESERVED_NAMES.has(slug)) {
    throw new ZipError("Invalid game slug.");
  }
}

function validateEntry(entry: Entry): { segments: string[]; directory: boolean } {
  const fileName = entry.fileName;
  if (!fileName || fileName.includes("\0") || fileName.includes("\\") ||
      /[\u0000-\u001f\u007f]/.test(fileName) || fileName.includes(":") ||
      path.posix.isAbsolute(fileName) || path.win32.isAbsolute(fileName) || /^[a-zA-Z]:/.test(fileName)) {
    throw new ZipError("The ZIP archive contains an unsafe file path.");
  }

  const directory = fileName.endsWith("/");
  const normalized = directory ? fileName.slice(0, -1) : fileName;
  if (!normalized) {
    throw new ZipError("The ZIP archive contains an unsafe file path.");
  }

  const segments = normalized.split("/");
  for (const segment of segments) {
    if (!segment || segment === "." || segment === ".." ||
        segment.endsWith(".") || segment.endsWith(" ") || Buffer.byteLength(segment) > 255) {
      throw new ZipError("The ZIP archive contains an unsafe file path.");
    }
    const basename = segment.split(".")[0]?.toLowerCase();
    if (basename && WINDOWS_RESERVED_NAMES.has(basename)) {
      throw new ZipError("The ZIP archive contains an unsafe file path.");
    }
  }

  const lowerName = normalized.toLowerCase();
  if (DANGEROUS_EXTENSIONS.some((extension) => lowerName.endsWith(extension))) {
    throw new ZipError("The ZIP archive contains an unsupported file type.");
  }

  const unixMode = (entry.externalFileAttributes >>> 16) & 0xffff;
  const fileType = unixMode & 0xf000;
  if (fileType === 0xa000) {
    throw new ZipError("The ZIP archive contains a symbolic link.");
  }
  if (fileType !== 0 && fileType !== 0x8000 && fileType !== 0x4000) {
    throw new ZipError("The ZIP archive contains an unsupported file type.");
  }
  if ((fileType === 0x4000 && !directory) || (fileType === 0x8000 && directory)) {
    throw new ZipError("The ZIP archive contains an invalid entry.");
  }

  if (entry.isEncrypted() || (entry.compressionMethod !== 0 && entry.compressionMethod !== 8)) {
    throw new ZipError("The ZIP archive uses an unsupported format.");
  }
  if (!Number.isSafeInteger(entry.compressedSize) || entry.compressedSize < 0 ||
      !Number.isSafeInteger(entry.uncompressedSize) || entry.uncompressedSize < 0 ||
      (directory && entry.uncompressedSize !== 0)) {
    throw new ZipError("The ZIP archive contains invalid entry sizes.");
  }
  if (!directory && entry.uncompressedSize > 0 &&
      (entry.compressedSize === 0 ||
       entry.uncompressedSize / entry.compressedSize > MAX_COMPRESSION_RATIO)) {
    throw new ZipError("The ZIP archive has a suspicious compression ratio.");
  }

  return { segments, directory };
}

function resolveTarget(root: string, segments: string[]): string {
  const target = path.resolve(root, ...segments);
  if (!isInside(root, target)) {
    throw new ZipError("The ZIP archive contains an unsafe file path.");
  }
  return target;
}

async function extractDirectory(root: string, target: string): Promise<void> {
  await mkdir(target, { recursive: true });
  const realTarget = await realpath(target);
  if (!isInsideOrEqual(root, realTarget)) {
    throw new ZipError("The ZIP archive contains an unsafe file path.");
  }
}

async function extractFile(zipfile: ZipFile, entry: Entry, root: string, target: string): Promise<void> {
  const parent = path.dirname(target);
  await mkdir(parent, { recursive: true });
  const realParent = await realpath(parent);
  if (!isInsideOrEqual(root, realParent)) {
    throw new ZipError("The ZIP archive contains an unsafe file path.");
  }

  let written = 0;
  const sizeGuard = new Transform({
    transform(chunk: Buffer, _encoding, callback) {
      written += chunk.length;
      if (written > entry.uncompressedSize || written > MAX_UNCOMPRESSED_BYTES) {
        callback(new ZipError("The ZIP archive exceeds the extraction limit."));
        return;
      }
      callback(null, chunk);
    },
  });

  const source = await zipfile.openReadStreamPromise(entry);
  await pipeline(source, sizeGuard, createWriteStream(target, { flags: "wx", mode: 0o600 }));
}

export async function withGamePublishLock<T>(slug: string, operation: () => Promise<T>): Promise<T> {
  const lockName = `gameportal:upload:${createHash("sha256").update(slug).digest("hex").slice(0, 32)}`;
  return prisma.$transaction(async (tx) => {
    const [lock] = await tx.$queryRaw<Array<{ acquired: number | null }>>`
      SELECT GET_LOCK(${lockName}, 30) AS acquired
    `;
    if (lock?.acquired !== 1) throw new ZipError("Another game build update is in progress.", 500);

    try {
      return await operation();
    } finally {
      await tx.$queryRaw`SELECT RELEASE_LOCK(${lockName})`;
    }
  }, { maxWait: 10_000, timeout: 60_000 });
}

async function publishBuild(
  slug: string,
  tempDir: string,
  runtimeRoot: string,
  destination: string,
): Promise<void> {
  await withGamePublishLock(slug, async () => {
    const backupPath = path.join(runtimeRoot, `.${slug}-${randomUUID()}.backup`);
    let backup: string | undefined;
    let published = false;

    try {
      let existing;
      try {
        existing = await lstat(destination);
      } catch (error) {
        if (!hasErrorCode(error, "ENOENT")) {
          throw error;
        }
      }

      if (existing) {
        if (!existing.isDirectory() || existing.isSymbolicLink()) {
          throw new ZipError("The game build destination is unavailable.", 500);
        }
        try {
          await rename(destination, backupPath);
          backup = backupPath;
        } catch (error) {
          if (!hasErrorCode(error, "ENOENT")) {
            throw error;
          }
        }
      }

      try {
        await rename(tempDir, destination);
        published = true;
      } catch (error) {
        if (backup) {
          try {
            await rename(backup, destination);
            backup = undefined;
          } catch {
            throw new ZipError("The previous game build could not be restored.", 500);
          }
        }
        throw error;
      }
    } catch (error) {
      if (error instanceof ZipError) {
        throw error;
      }
      throw new ZipError("The game build could not be published.", 500);
    } finally {
      if (published && backup) {
        try {
          await rm(backup, { recursive: true, force: true, maxRetries: 3, retryDelay: 100 });
        } catch {
          throw new ZipError("The previous game build could not be removed.", 500);
        }
      }
    }
  });
}

export async function extractGameZip(buffer: Buffer, slug: string): Promise<string> {
  let tempDir: string | undefined;

  try {
    validateSlug(slug);

    const projectRoot = process.cwd();
    const runtimeRoot = path.join(projectRoot, ".runtime", "uploads");
    const gamesRoot = path.join(projectRoot, "public", "uploads", "games");
    const destination = path.resolve(gamesRoot, slug);
    if (!isInside(gamesRoot, destination)) {
      throw new ZipError("Invalid game slug.");
    }

    await mkdir(runtimeRoot, { recursive: true });
    await mkdir(gamesRoot, { recursive: true });
    tempDir = await mkdtemp(path.join(runtimeRoot, `${slug}-`));
    const extractionRoot = await realpath(tempDir);

    const zipfile = await fromBufferPromise(buffer, {
      lazyEntries: true,
      strictFileNames: true,
      validateEntrySizes: true,
    });

    let entryCount = 0;
    let totalUncompressed = 0;
    let hasRootIndex = false;
    const seenPaths = new Set<string>();

    try {
      if (zipfile.entryCount > MAX_ENTRIES) {
        throw new ZipError("The ZIP archive contains too many entries.");
      }

      for await (const entry of zipfile.eachEntry()) {
        entryCount += 1;
        if (entryCount > MAX_ENTRIES) {
          throw new ZipError("The ZIP archive contains too many entries.");
        }

        const { segments, directory } = validateEntry(entry);
        const canonicalPath = segments.join("/").toLowerCase();
        if (seenPaths.has(canonicalPath)) {
          throw new ZipError("The ZIP archive contains duplicate entries.");
        }
        seenPaths.add(canonicalPath);

        if (entry.uncompressedSize > MAX_UNCOMPRESSED_BYTES - totalUncompressed) {
          throw new ZipError("The ZIP archive exceeds the extraction limit.");
        }
        totalUncompressed += entry.uncompressedSize;

        const target = resolveTarget(extractionRoot, segments);
        if (directory) {
          await extractDirectory(extractionRoot, target);
        } else {
          if (segments.length === 1 && segments[0] === "index.html") {
            hasRootIndex = true;
          }
          await extractFile(zipfile, entry, extractionRoot, target);
        }
      }
    } finally {
      zipfile.close();
    }

    if (!hasRootIndex) {
      throw new ZipError("The ZIP archive must contain index.html at its root.");
    }

    const indexPath = path.join(extractionRoot, "index.html");
    const indexStats = await lstat(indexPath);
    if (!indexStats.isFile() || indexStats.isSymbolicLink()) {
      throw new ZipError("The ZIP archive must contain index.html at its root.");
    }

    await publishBuild(slug, tempDir, runtimeRoot, destination);
    return `/uploads/games/${slug}/index.html`;
  } catch (error) {
    if (error instanceof ZipError) {
      throw error;
    }
    throw new ZipError("The ZIP archive is invalid or could not be read.");
  } finally {
    if (tempDir) {
      await rm(tempDir, { recursive: true, force: true, maxRetries: 3, retryDelay: 100 });
    }
  }
}
