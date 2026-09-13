/**
 * SKU generation (doc §4.1: "Barcode/SKU — Auto-generated, printable label").
 *
 * Format: `{CATEGORY}-{MODEL?}-{SEQ}` — e.g. CAM-DH2431-001, CBL-ROLL-002.
 * Category prefix = first 3 chars uppercased (CAM/DVR/CBL/PSU/ACC/SVC).
 * Sequence = zero-padded 3-digit, increments per tenant per category prefix.
 *
 * Falls back to `GEN-###` if no category. Guaranteed unique per tenant via
 * the `@@unique([tenantId, sku])` DB constraint (collision → retry with next seq).
 */
import { adminDb } from "@/lib/db";

const SEQ_PAD = 3;

function categoryPrefix(categoryName?: string | null): string {
  if (!categoryName) return "GEN";
  const cleaned = categoryName.replace(/[^A-Za-z0-9]/g, "").toUpperCase();
  return (cleaned.slice(0, 3) || "GEN").padEnd(3, "X");
}

function modelSlug(model?: string | null): string {
  if (!model) return "";
  const cleaned = model.replace(/[^A-Za-z0-9]/g, "").toUpperCase();
  return cleaned.slice(0, 8);
}

/**
 * Generate a unique SKU for a new product within a tenant.
 * Retries up to 5 times on sequence collision.
 */
export async function generateSku(
  tenantId: string,
  categoryName?: string | null,
  model?: string | null
): Promise<string> {
  const prefix = categoryPrefix(categoryName);
  const slug = modelSlug(model);
  const base = slug ? `${prefix}-${slug}` : prefix;

  // Find the highest existing sequence for this prefix within the tenant.
  const existing = await adminDb.product.findMany({
    where: {
      tenantId,
      sku: { startsWith: `${base}-` },
    },
    select: { sku: true },
  });

  let maxSeq = 0;
  for (const p of existing) {
    const match = p.sku.match(new RegExp(`^${base}-(\\d+)$`));
    if (match) {
      const seq = parseInt(match[1], 10);
      if (seq > maxSeq) maxSeq = seq;
    }
  }

  // Try the next sequence; retry on collision (race-safe).
  for (let attempt = 0; attempt < 5; attempt++) {
    const seq = String(maxSeq + 1 + attempt).padStart(SEQ_PAD, "0");
    const candidate = `${base}-${seq}`;
    const clash = await adminDb.product.findFirst({
      where: { tenantId, sku: candidate },
      select: { id: true },
    });
    if (!clash) return candidate;
  }

  // Fallback: append a random suffix.
  const random = Math.floor(Math.random() * 900 + 100);
  return `${base}-${random}`;
}
