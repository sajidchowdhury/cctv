"use client";

import { useState } from "react";
import { Card, CardContent, CardHeader, CardTitle, CardDescription } from "@/components/ui/card";
import { Input } from "@/components/ui/input";
import { Button } from "@/components/ui/button";
import { Label } from "@/components/ui/label";
import { Loader2, Mail } from "lucide-react";

export default function ChangeEmailPage() {
  const [newEmail, setNewEmail] = useState("");
  const [loading, setLoading] = useState(false);
  const [error, setError] = useState<string | null>(null);
  const [msg, setMsg] = useState<string | null>(null);

  async function onSubmit(e: React.FormEvent) {
    e.preventDefault();
    setLoading(true);
    setError(null);
    setMsg(null);
    const res = await fetch("/api/auth/change-email", {
      method: "POST",
      headers: { "Content-Type": "application/json" },
      body: JSON.stringify({ newEmail }),
    });
    const data = await res.json();
    setLoading(false);
    if (!res.ok) {
      setError(data.error || "Failed to send OTP.");
      return;
    }
    setMsg(data.message);
  }

  return (
    <main className="min-h-screen flex flex-col items-center justify-center bg-background px-4 py-10">
      <div className="w-full max-w-sm space-y-6">
        <div className="flex flex-col items-center gap-2 text-center">
          <div className="inline-flex h-12 w-12 items-center justify-center rounded-xl bg-primary text-primary-foreground">
            <Mail className="h-6 w-6" />
          </div>
          <h1 className="text-xl font-semibold tracking-tight">Change email</h1>
          <p className="text-sm text-muted-foreground">
            We will send a confirmation code to the new address. The old email
            enters a 7-day cooldown.
          </p>
        </div>
        <Card>
          <CardHeader>
            <CardTitle>New email</CardTitle>
            <CardDescription>OTP verification required.</CardDescription>
          </CardHeader>
          <CardContent>
            <form onSubmit={onSubmit} className="space-y-4">
              <div className="space-y-2">
                <Label htmlFor="newEmail">New email address</Label>
                <Input id="newEmail" type="email" required value={newEmail}
                  onChange={(e) => setNewEmail(e.target.value)} placeholder="new@shop.bd" />
              </div>
              {error && <p className="text-sm text-destructive" role="alert">{error}</p>}
              {msg && <p className="text-sm text-primary">{msg}</p>}
              <Button type="submit" className="w-full" disabled={loading}>
                {loading && <Loader2 className="mr-2 h-4 w-4 animate-spin" />}
                Send confirmation code
              </Button>
            </form>
          </CardContent>
        </Card>
      </div>
    </main>
  );
}
