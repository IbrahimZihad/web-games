import { randomUUID } from "node:crypto";
import { lstat, mkdir, open, realpath, unlink, type FileHandle } from "node:fs/promises";
import path from "node:path";

export interface StoredObject {
  url: string;
  key: string;
}

export interface StorageService {
  save(file: File): Promise<StoredObject>;
  deleteObject(key: string): Promise<void>;
}

const MEDIA_EXTENSIONS = new Set([".jpg", ".jpeg", ".png", ".webp", ".mp4", ".webm"]);

function hasErrorCode(error: unknown, code: string): boolean {
  return typeof error === "object" && error !== null && "code" in error &&
    (error as { code?: unknown }).code === code;
}

function isInside(root: string, target: string): boolean {
  const relative = path.relative(root, target);
  return relative !== "" && relative !== ".." && !relative.startsWith(`..${path.sep}`) &&
    !path.isAbsolute(relative);
}

function resolveKey(root: string, key: string): string {
  if (!key || key.includes("\0") || key.includes("\\") || key.includes(":") ||
      path.posix.isAbsolute(key) || path.win32.isAbsolute(key) || /^[a-zA-Z]:/.test(key)) {
    throw new Error("Invalid storage key.");
  }

  const segments = key.split("/");
  if (segments.some((segment) => !segment || segment === "." || segment === "..")) {
    throw new Error("Invalid storage key.");
  }

  const target = path.resolve(root, ...segments);
  if (!isInside(root, target)) {
    throw new Error("Invalid storage key.");
  }
  return target;
}

function getSafeExtension(fileName: string): string {
  const extension = path.extname(fileName).toLowerCase();
  if (!MEDIA_EXTENSIONS.has(extension)) {
    throw new Error("Unsupported media file.");
  }
  return extension;
}

class LocalMediaStorage implements StorageService {
  private readonly root = path.resolve(process.cwd(), "public", "uploads", "media");

  async save(file: File): Promise<StoredObject> {
    const extension = getSafeExtension(file.name);
    const key = `${randomUUID()}${extension}`;
    const target = resolveKey(this.root, key);

    await mkdir(this.root, { recursive: true });
    const data = Buffer.from(await file.arrayBuffer());

    let handle: FileHandle | undefined;
    let created = false;
    try {
      handle = await open(target, "wx", 0o600);
      created = true;
      await handle.writeFile(data);
      await handle.close();
      handle = undefined;
    } catch (error) {
      if (handle) {
        await handle.close().catch(() => undefined);
      }
      if (created) {
        await unlink(target).catch(() => undefined);
      }
      throw error;
    }

    return { url: `/uploads/media/${key}`, key };
  }

  async deleteObject(key: string): Promise<void> {
    const target = resolveKey(this.root, key);
    let stats;
    try {
      stats = await lstat(target);
    } catch (error) {
      if (hasErrorCode(error, "ENOENT")) {
        return;
      }
      throw error;
    }

    if (!stats.isFile() || stats.isSymbolicLink()) {
      throw new Error("Invalid storage object.");
    }

    const [realRoot, realTarget] = await Promise.all([realpath(this.root), realpath(target)]);
    if (!isInside(realRoot, realTarget)) {
      throw new Error("Invalid storage key.");
    }

    await unlink(target);
  }
}

export const storageService: StorageService = new LocalMediaStorage();
