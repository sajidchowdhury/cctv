/**
 * GET /api/uploads/[...path] — serve an uploaded file from disk.
 *
 * Files are written to ./uploads/<key> by LocalStorageDriver (see
 * src/lib/adapters/storage.ts). Next.js only auto-serves the public/ folder,
 * so without this route handler, <img src="/api/uploads/foo.jpg"> would 404.
 *
 * This handler also acts as the single source of truth for the upload URL
 * prefix — LocalStorageDriver.getUrl() returns `/api/uploads/<key>` and
 * the assetUrl() helper prepends the /cctv basePath at render time.
 *
 * Security:
 *  - Path is restricted to UPLOAD_DIR (directory-traversal blocked).
 *  - Content-Type is derived from extension, defaulting to octet-stream.
 *  - Cache headers are aggressive (immutable) since uploads are content-addressed
 *    by timestamp + random suffix and never overwritten.
 */
import { NextResponse } from "next/server";
import { promises as fs } from "fs";
import path from "path";

const UPLOAD_DIR = path.join(process.cwd(), "uploads");

const CONTENT_TYPES: Record<string, string> = {
  ".jpg": "image/jpeg",
  ".jpeg": "image/jpeg",
  ".png": "image/png",
  ".webp": "image/webp",
  ".gif": "image/gif",
  ".svg": "image/svg+xml",
  ".pdf": "application/pdf",
};

export async function GET(
  _req: Request,
  ctx: { params: Promise<{ path: string[] }> }
) {
  const { path: parts } = await ctx.params;
  const safeRel = parts.join("/");

  // Reject empty path or traversal attempts.
  if (!safeRel || safeRel.includes("..")) {
    return new NextResponse("Bad request", { status: 400 });
  }

  const filePath = path.join(UPLOAD_DIR, safeRel);
  // Resolve and ensure we're still inside UPLOAD_DIR.
  const resolved = path.resolve(filePath);
  if (!resolved.startsWith(UPLOAD_DIR + path.sep) && resolved !== UPLOAD_DIR) {
    return new NextResponse("Forbidden", { status: 403 });
  }

  try {
    const buf = await fs.readFile(resolved);
    const ext = path.extname(resolved).toLowerCase();
    const contentType =
      CONTENT_TYPES[ext] ?? "application/octet-stream";

    return new NextResponse(buf, {
      headers: {
        "Content-Type": contentType,
        "Content-Length": String(buf.length),
        "Cache-Control": "public, max-age=31536000, immutable",
      },
    });
  } catch {
    return new NextResponse("Not found", { status: 404 });
  }
}
