"use client";

import { useState } from "react";
import { signIn } from "next-auth/react";
import { useRouter } from "next/navigation";
import { Card, CardContent, CardHeader, CardTitle, CardDescription } from "@/components/ui/card";
import { Input } from "@/components/ui/input";
import { Button } from "@/components/ui/button";
import { Label } from "@/components/ui/label";
import { ShieldAlert, Loader2 } from "lucide-react";

export default function AdminLoginPage() {
  const router = useRouter();
  const [email, setEmail] = useState("");
  const [password, setPassword] = useState("");
  const [loading, setLoading] = useState(false);
  const [error, setError] = useState<string | null>(null);

  async function onSubmit(e: React.FormEvent) {
    e.preventDefault();
    setLoading(true);
    setError(null);
    const res = await signIn("admin-credentials", {
      email,
      password,
      redirect: false,
      callbackUrl: "/admin/verifications",
    });
    setLoading(false);
    if (!res || res.error) {
      setError("Invalid admin credentials.");
      return;
    }
    router.push("/admin/verifications");
    router.refresh();
  }

  return (
    <main className="min-h-screen flex flex-col items-center justify-center bg-background px-4 py-10">
      <div className="w-full max-w-sm space-y-6">
        <div className="flex flex-col items-center gap-2 text-center">
          <div className="inline-flex h-12 w-12 items-center justify-center rounded-xl bg-destructive text-destructive-foreground">
            <ShieldAlert className="h-6 w-6" />
          </div>
          <h1 className="text-xl font-semibold tracking-tight">Super-admin login</h1>
          <p className="text-sm text-muted-foreground">
            Platform control plane. Payment verification + tenant management.
          </p>
        </div>
        <Card>
          <CardHeader>
            <CardTitle>Admin sign in</CardTitle>
            <CardDescription>Separate from tenant accounts.</CardDescription>
          </CardHeader>
          <CardContent>
            <form onSubmit={onSubmit} className="space-y-4">
              <div className="space-y-2">
                <Label htmlFor="email">Email</Label>
                <Input id="email" type="email" required value={email}
                  onChange={(e) => setEmail(e.target.value)} placeholder="admin@cctv-saas.bd" />
              </div>
              <div className="space-y-2">
                <Label htmlFor="password">Password</Label>
                <Input id="password" type="password" required value={password}
                  onChange={(e) => setPassword(e.target.value)} placeholder="••••••••" />
              </div>
              {error && <p className="text-sm text-destructive" role="alert">{error}</p>}
              <Button type="submit" className="w-full" disabled={loading}>
                {loading && <Loader2 className="mr-2 h-4 w-4 animate-spin" />}
                Sign in
              </Button>
            </form>
          </CardContent>
        </Card>
      </div>
    </main>
  );
}
