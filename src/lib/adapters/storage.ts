/**
 * IStorage — file storage adapter (doc §2 stack, §4 product images, §5.6 quote PDFs).
 *
 * Production: S3-compatible (Cloudflare R2 / MinIO).
 * Dev build: LocalStorageDriver (writes to ./uploads/).
 */

import { promises as fs } from "fs";
import path from "path";

export interface UploadResult {
  key: string;
  url: string;
  contentType: string;
  size: number;
}

export interface IStorage {
  /** Upload a file buffer, return its public URL + metadata. */
  upload(
    file: Buffer,
    key: string,
    contentType: string
  ): Promise<UploadResult>;
  /** Delete a file by key. */
  delete(key: string): Promise<void>;
  /** Resolve the public URL for a stored key. */
  getUrl(key: string): string;
}

const UPLOAD_DIR = path.join(process.cwd(), "uploads");

/**
 * Local filesystem storage driver.
 * Files written to ./uploads/ and served via /uploads path.
 */
export class LocalStorageDriver implements IStorage {
  constructor(private baseDir: string = UPLOAD_DIR) {}

  async upload(
    file: Buffer,
    key: string,
    contentType: string
  ): Promise<UploadResult> {
    const filePath = path.join(this.baseDir, key);
    await fs.mkdir(path.dirname(filePath), { recursive: true });
    await fs.writeFile(filePath, file);
    return {
      key,
      url: this.getUrl(key),
      contentType,
      size: file.length,
    };
  }

  async delete(key: string): Promise<void> {
    const filePath = path.join(this.baseDir, key);
    try {
      await fs.unlink(filePath);
    } catch {
      // ignore missing files
    }
  }

  getUrl(key: string): string {
    // Route through the /api/uploads/[...path] handler (src/app/api/uploads/[...path]/route.ts)
    // — Next.js does NOT auto-serve files outside public/, so we serve them via a route
    // handler. The /cctv basePath is prepended at render time via assetUrl().
    return `/api/uploads/${key}`;
  }
}

let _storage: IStorage | null = null;

export function getStorage(): IStorage {
  if (!_storage) {
    _storage = new LocalStorageDriver();
  }
  return _storage;
}
