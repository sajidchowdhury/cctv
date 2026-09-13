"use client";
import { useEffect } from "react";
import { useRouter } from "next/navigation";
export default function StockReportRedirect() {
  const router = useRouter();
  useEffect(() => { router.replace("/stock"); }, [router]);
  return <p className="text-sm text-muted-foreground py-8 text-center">Redirecting to stock summary…</p>;
}
