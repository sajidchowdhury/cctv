"use client";

import Link from "next/link";
import { Card, CardContent, CardHeader, CardTitle, CardDescription } from "@/components/ui/card";
import { Button } from "@/components/ui/button";
import { Lock, CreditCard } from "lucide-react";
import { signOut } from "next-auth/react";

export default function PaymentPage() {
  return (
    <main className="min-h-screen flex flex-col items-center justify-center bg-background px-4 py-10">
      <div className="w-full max-w-sm space-y-6">
        <div className="flex flex-col items-center gap-2 text-center">
          <div className="inline-flex h-12 w-12 items-center justify-center rounded-xl bg-primary text-primary-foreground">
            <Lock className="h-6 w-6" />
          </div>
          <h1 className="text-xl font-semibold tracking-tight">Activate your subscription</h1>
          <p className="text-sm text-muted-foreground">
            Pay BDT 500/month to the admin&apos;s bKash / Nagad / Bank number,
            then submit the transaction ID below.
          </p>
        </div>
        <Card>
          <CardHeader>
            <CardTitle className="flex items-center gap-2">
              <CreditCard className="h-5 w-5" /> Renew / submit payment
            </CardTitle>
            <CardDescription>
              The full payment form (transaction ID, amount, date, sender
              number) is built in Session S05.
            </CardDescription>
          </CardHeader>
          <CardContent className="space-y-3 text-sm">
            <p className="text-muted-foreground">
              This screen is reachable while your account is
              <strong> pending activation</strong> or <strong>locked</strong>.
              Once the admin verifies your transaction ID, access is restored
              within 60 seconds.
            </p>
            <div className="flex flex-col gap-2 pt-2">
              <Button asChild>
                <Link href="/">Try the dashboard again</Link>
              </Button>
              <Button variant="outline" onClick={() => signOut({ callbackUrl: "/login" })}>
                Log out
              </Button>
            </div>
          </CardContent>
        </Card>
      </div>
    </main>
  );
}
