/**
 * Health-check endpoint — confirms the API layer + infrastructure are wired.
 * GET /api/health
 */
import { NextResponse } from "next/server";
import { db } from "@/lib/db";

export async function GET() {
  let dbStatus: "ok" | "error" = "error";
  try {
    // Lightweight connectivity probe (works on the current dev schema)
    await db.$queryRaw`SELECT 1`;
    dbStatus = "ok";
  } catch {
    dbStatus = "error";
  }

  return NextResponse.json({
    status: "ok",
    service: "cctv-inventory-saas",
    phase: "P0",
    session: "S01",
    db: dbStatus,
    timestamp: new Date().toISOString(),
  });
}
