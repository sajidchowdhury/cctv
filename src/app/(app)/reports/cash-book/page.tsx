"use client";
import { useEffect } from "react";
import { useRouter } from "next/navigation";
export default function CashBookReportRedirect() {
  const router = useRouter();
  useEffect(() => { router.replace("/accounting/cash-book"); }, [router]);
  return <p className="text-sm text-muted-foreground py-8 text-center">Redirecting to cash book…</p>;
}
