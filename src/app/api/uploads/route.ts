/**
 * POST /api/uploads — upload a file via IStorage adapter (doc §4.1 product images).
 * Accepts multipart/form-data; returns the public URL.
 */
import { NextResponse } from "next/server";
import { withTenant } from "@/lib/session";
import { getStorage } from "@/lib/adapters/storage";

const MAX_SIZE = 5 * 1024 * 1024; // 5 MB
const ALLOWED = ["image/jpeg", "image/png", "image/webp", "application/pdf"];

export const POST = withTenant(async (user, req: Request) => {
  const formData = await req.formData();
  const file = formData.get("file");
  if (!(file instanceof File)) {
    return NextResponse.json({ error: "No file provided (field: 'file')." }, { status: 400 });
  }
  if (file.size > MAX_SIZE) {
    return NextResponse.json({ error: "File too large (max 5 MB)." }, { status: 413 });
  }
  if (!ALLOWED.includes(file.type)) {
    return NextResponse.json({ error: `Unsupported type: ${file.type}.` }, { status: 415 });
  }

  const buf = Buffer.from(await file.arrayBuffer());
  const ext = file.name.split(".").pop()?.toLowerCase() ?? "bin";
  const key = `products/${user.tenantId}/${Date.now()}-${Math.random().toString(36).slice(2, 8)}.${ext}`;

  const storage = getStorage();
  const result = await storage.upload(buf, key, file.type);

  return NextResponse.json({ url: result.url, key: result.key, size: result.size }, { status: 201 });
});
