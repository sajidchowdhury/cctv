"use client";
import { useEffect } from "react";
import { useRouter } from "next/navigation";
export default function StockPageRedirect() {
  const router = useRouter();
  useEffect(() => { router.replace("/reports/stock"); }, [router]);
  return <p className="text-sm text-muted-foreground py-8 text-center">Redirecting to stock report…</p>;
}
