"use client";

import { useState, useRef } from "react";
import { useQuery, useQueryClient } from "@tanstack/react-query";
import { PageHeader } from "@/components/layout/page-header";
import { Card, CardContent, CardHeader, CardTitle, CardDescription } from "@/components/ui/card";
import { Input } from "@/components/ui/input";
import { Button } from "@/components/ui/button";
import { Label } from "@/components/ui/label";
import { Textarea } from "@/components/ui/textarea";
import { Tabs, TabsContent, TabsList, TabsTrigger } from "@/components/ui/tabs";
import { Loader2, Save, Upload, Trash2, Building2, Palette, User, Lock, Image as ImageIcon, Eye, AlertCircle } from "lucide-react";
import { useToast } from "@/hooks/use-toast";
import { useSession } from "next-auth/react";
import { assetUrl } from "@/lib/app-path";

type Profile = {
  id: string;
  name: string;
  phone: string | null;
  address: string | null;
  businessLogo: string | null;
  invoiceHeaderImage: string | null;
  invoiceFooterImage: string | null;
  invoiceProductsPerPage: number;
  invoiceAccentColor: string | null;
};

export default function SettingsPage() {
  const { toast } = useToast();
  const qc = useQueryClient();
  const { data: session, update: updateSession } = useSession();
  const [tab, setTab] = useState("business");
  const [saving, setSaving] = useState(false);
  const [uploading, setUploading] = useState<string | null>(null);

  // Business profile form state
  const [form, setForm] = useState<Partial<Profile>>({});

  // Account form state
  const [userName, setUserName] = useState("");
  const [currentPassword, setCurrentPassword] = useState("");
  const [newPassword, setNewPassword] = useState("");
  const [confirmPassword, setConfirmPassword] = useState("");
  const [changingPassword, setChangingPassword] = useState(false);
  const [savingName, setSavingName] = useState(false);

  const { data, isLoading } = useQuery({
    queryKey: ["business-profile"],
    queryFn: async () => (await (await fetch("/cctv/api/business-profile")).json()).profile,
  });

  // Sync form when data loads
  const [formLoaded, setFormLoaded] = useState(false);
  if (data && !formLoaded) {
    setForm(data);
    setUserName(session?.user?.name ?? "");
    setFormLoaded(true);
  }

  async function uploadFile(file: File, field: "businessLogo" | "invoiceHeaderImage" | "invoiceFooterImage") {
    setUploading(field);
    try {
      const formData = new FormData();
      formData.append("file", file);
      const res = await fetch("/cctv/api/uploads", { method: "POST", body: formData });
      const data = await res.json();
      if (!res.ok) {
        toast({ title: "Upload failed", description: data.error, variant: "destructive" });
        return;
      }
      // Update the form + save immediately
      setForm((f) => ({ ...f, [field]: data.url }));
      await saveProfile({ [field]: data.url });
    } finally {
      setUploading(null);
    }
  }

  async function saveProfile(updates: Partial<Profile>) {
    setSaving(true);
    try {
      const res = await fetch("/cctv/api/business-profile", {
        method: "PATCH",
        headers: { "Content-Type": "application/json" },
        body: JSON.stringify(updates),
      });
      const data = await res.json();
      if (!res.ok) {
        toast({ title: "Failed", description: data.error ?? "Could not save.", variant: "destructive" });
        return;
      }
      setForm(data.profile);
      qc.invalidateQueries({ queryKey: ["business-profile"] });
      toast({ title: "Saved", description: "Business profile updated." });
    } finally {
      setSaving(false);
    }
  }

  async function saveBusinessProfile() {
    await saveProfile({
      name: form.name,
      phone: form.phone || null,
      address: form.address || null,
    });
  }

  async function saveInvoiceSettings() {
    await saveProfile({
      invoiceProductsPerPage: Number(form.invoiceProductsPerPage) || 10,
      invoiceAccentColor: form.invoiceAccentColor || "#1A73E8",
    });
  }

  async function removeImage(field: "businessLogo" | "invoiceHeaderImage" | "invoiceFooterImage") {
    setForm((f) => ({ ...f, [field]: null }));
    await saveProfile({ [field]: null });
  }

  async function saveUserName() {
    if (!userName.trim() || userName.trim().length < 2) {
      toast({ title: "Name too short", variant: "destructive" });
      return;
    }
    setSavingName(true);
    try {
      const res = await fetch("/cctv/api/account/profile", {
        method: "PATCH",
        headers: { "Content-Type": "application/json" },
        body: JSON.stringify({ name: userName.trim() }),
      });
      const data = await res.json();
      if (!res.ok) {
        toast({ title: "Failed", description: data.error, variant: "destructive" });
        return;
      }
      await updateSession();
      toast({ title: "Name updated", description: data.user.name });
    } finally {
      setSavingName(false);
    }
  }

  async function changePassword() {
    if (newPassword !== confirmPassword) {
      toast({ title: "Passwords don't match", variant: "destructive" });
      return;
    }
    if (newPassword.length < 6) {
      toast({ title: "Password too short", description: "Minimum 6 characters.", variant: "destructive" });
      return;
    }
    setChangingPassword(true);
    try {
      const res = await fetch("/cctv/api/account/password", {
        method: "POST",
        headers: { "Content-Type": "application/json" },
        body: JSON.stringify({ currentPassword, newPassword }),
      });
      const data = await res.json();
      if (!res.ok) {
        toast({ title: "Failed", description: data.error ?? "Could not change password.", variant: "destructive" });
        return;
      }
      toast({ title: "Password changed", description: "Use your new password next time you log in." });
      setCurrentPassword("");
      setNewPassword("");
      setConfirmPassword("");
    } finally {
      setChangingPassword(false);
    }
  }

  if (isLoading) {
    return <div className="flex justify-center py-12"><Loader2 className="h-6 w-6 animate-spin text-muted-foreground" /></div>;
  }

  return (
    <div className="space-y-6">
      <PageHeader
        title="Settings"
        description="Manage your business profile, invoice design, and account."
      />

      <Tabs value={tab} onValueChange={setTab}>
        <TabsList className="grid w-full grid-cols-3 max-w-md">
          <TabsTrigger value="business"><Building2 className="mr-2 h-4 w-4" /> Business</TabsTrigger>
          <TabsTrigger value="invoice"><Palette className="mr-2 h-4 w-4" /> Invoice</TabsTrigger>
          <TabsTrigger value="account"><User className="mr-2 h-4 w-4" /> Account</TabsTrigger>
        </TabsList>

        {/* ── Business Profile tab ── */}
        <TabsContent value="business" className="space-y-6">
          <Card>
            <CardHeader>
              <CardTitle className="text-base">Business identity</CardTitle>
              <CardDescription>This appears in the sidebar + on invoices.</CardDescription>
            </CardHeader>
            <CardContent className="space-y-4">
              {/* Logo upload */}
              <div className="space-y-2">
                <Label>Business logo</Label>
                <div className="flex items-center gap-4">
                  <div className="h-20 w-20 rounded-lg border-2 border-dashed flex items-center justify-center overflow-hidden bg-muted/30">
                    {form.businessLogo ? (
                      // eslint-disable-next-line @next/next/no-img-element
                      <img src={assetUrl(form.businessLogo) ?? ""} alt="Logo" className="h-full w-full object-contain" />
                    ) : (
                      <ImageIcon className="h-8 w-8 text-muted-foreground" />
                    )}
                  </div>
                  <div className="space-y-2">
                    <label>
                      <input
                        type="file"
                        accept="image/*"
                        className="hidden"
                        onChange={(e) => {
                          const f = e.target.files?.[0];
                          if (f) uploadFile(f, "businessLogo");
                        }}
                      />
                      <Button type="button" variant="outline" size="sm" asChild>
                        <span>{uploading === "businessLogo" ? <Loader2 className="mr-2 h-4 w-4 animate-spin" /> : <Upload className="mr-2 h-4 w-4" />} Upload logo</span>
                      </Button>
                    </label>
                    {form.businessLogo && (
                      <Button type="button" variant="ghost" size="sm" onClick={() => removeImage("businessLogo")}>
                        <Trash2 className="mr-2 h-4 w-4" /> Remove
                      </Button>
                    )}
                    <p className="text-xs text-muted-foreground">PNG/JPG, max 5 MB. Square recommended.</p>
                  </div>
                </div>
              </div>

              {/* Business name */}
              <div className="space-y-2">
                <Label htmlFor="name">Business name *</Label>
                <Input id="name" value={form.name ?? ""} onChange={(e) => setForm((f) => ({ ...f, name: e.target.value }))} placeholder="e.g. Dhaka CCTV Solutions" />
              </div>

              {/* Phone + address */}
              <div className="grid sm:grid-cols-2 gap-4">
                <div className="space-y-2">
                  <Label htmlFor="phone">Phone</Label>
                  <Input id="phone" value={form.phone ?? ""} onChange={(e) => setForm((f) => ({ ...f, phone: e.target.value }))} placeholder="01XXXXXXXXX" />
                </div>
                <div className="space-y-2">
                  <Label htmlFor="address">Address</Label>
                  <Input id="address" value={form.address ?? ""} onChange={(e) => setForm((f) => ({ ...f, address: e.target.value }))} placeholder="Shop address" />
                </div>
              </div>

              <Button onClick={saveBusinessProfile} disabled={saving}>
                {saving ? <Loader2 className="mr-2 h-4 w-4 animate-spin" /> : <Save className="mr-2 h-4 w-4" />}
                Save business profile
              </Button>
            </CardContent>
          </Card>
        </TabsContent>

        {/* ── Invoice Design tab ── */}
        <TabsContent value="invoice" className="space-y-6">
          <Card>
            <CardHeader>
              <CardTitle className="text-base">Invoice branding</CardTitle>
              <CardDescription>Customize how your invoices look. Default header + footer are used if no image is uploaded.</CardDescription>
            </CardHeader>
            <CardContent className="space-y-6">
              {/* Header image */}
              <div className="space-y-2">
                <Label>Invoice header image</Label>
                <div className="flex items-start gap-4">
                  <div className="h-24 w-full max-w-xs rounded-lg border-2 border-dashed flex items-center justify-center overflow-hidden bg-muted/30">
                    {form.invoiceHeaderImage ? (
                      // eslint-disable-next-line @next/next/no-img-element
                      <img src={assetUrl(form.invoiceHeaderImage) ?? ""} alt="Header" className="h-full w-full object-cover" />
                    ) : (
                      <div className="text-center text-xs text-muted-foreground p-2">
                        <ImageIcon className="h-6 w-6 mx-auto mb-1" />
                        Default header
                      </div>
                    )}
                  </div>
                  <div className="space-y-2">
                    <label>
                      <input
                        type="file"
                        accept="image/*"
                        className="hidden"
                        onChange={(e) => {
                          const f = e.target.files?.[0];
                          if (f) uploadFile(f, "invoiceHeaderImage");
                        }}
                      />
                      <Button type="button" variant="outline" size="sm" asChild>
                        <span>{uploading === "invoiceHeaderImage" ? <Loader2 className="mr-2 h-4 w-4 animate-spin" /> : <Upload className="mr-2 h-4 w-4" />} Upload header</span>
                      </Button>
                    </label>
                    {form.invoiceHeaderImage && (
                      <Button type="button" variant="ghost" size="sm" onClick={() => removeImage("invoiceHeaderImage")}>
                        <Trash2 className="mr-2 h-4 w-4" /> Remove
                      </Button>
                    )}
                    <p className="text-xs text-muted-foreground">Wide banner image. Shown at the top of each invoice page.</p>
                  </div>
                </div>
              </div>

              {/* Footer image */}
              <div className="space-y-2">
                <Label>Invoice footer image</Label>
                <div className="flex items-start gap-4">
                  <div className="h-24 w-full max-w-xs rounded-lg border-2 border-dashed flex items-center justify-center overflow-hidden bg-muted/30">
                    {form.invoiceFooterImage ? (
                      // eslint-disable-next-line @next/next/no-img-element
                      <img src={assetUrl(form.invoiceFooterImage) ?? ""} alt="Footer" className="h-full w-full object-cover" />
                    ) : (
                      <div className="text-center text-xs text-muted-foreground p-2">
                        <ImageIcon className="h-6 w-6 mx-auto mb-1" />
                        Default footer
                      </div>
                    )}
                  </div>
                  <div className="space-y-2">
                    <label>
                      <input
                        type="file"
                        accept="image/*"
                        className="hidden"
                        onChange={(e) => {
                          const f = e.target.files?.[0];
                          if (f) uploadFile(f, "invoiceFooterImage");
                        }}
                      />
                      <Button type="button" variant="outline" size="sm" asChild>
                        <span>{uploading === "invoiceFooterImage" ? <Loader2 className="mr-2 h-4 w-4 animate-spin" /> : <Upload className="mr-2 h-4 w-4" />} Upload footer</span>
                      </Button>
                    </label>
                    {form.invoiceFooterImage && (
                      <Button type="button" variant="ghost" size="sm" onClick={() => removeImage("invoiceFooterImage")}>
                        <Trash2 className="mr-2 h-4 w-4" /> Remove
                      </Button>
                    )}
                    <p className="text-xs text-muted-foreground">Shown at the bottom of each invoice page.</p>
                  </div>
                </div>
              </div>

              {/* Products per page + accent color */}
              <div className="grid sm:grid-cols-2 gap-4">
                <div className="space-y-2">
                  <Label htmlFor="productsPerPage">Products per page</Label>
                  <Input
                    id="productsPerPage"
                    type="number"
                    min={1}
                    max={50}
                    value={form.invoiceProductsPerPage ?? 10}
                    onChange={(e) => setForm((f) => ({ ...f, invoiceProductsPerPage: Number(e.target.value) }))}
                  />
                  <p className="text-xs text-muted-foreground">Max products shown per invoice page before pagination kicks in.</p>
                </div>
                <div className="space-y-2">
                  <Label htmlFor="accentColor">Accent color</Label>
                  <div className="flex items-center gap-2">
                    <input
                      type="color"
                      id="accentColor"
                      value={form.invoiceAccentColor ?? "#1A73E8"}
                      onChange={(e) => setForm((f) => ({ ...f, invoiceAccentColor: e.target.value }))}
                      className="h-10 w-14 rounded border cursor-pointer"
                    />
                    <Input
                      value={form.invoiceAccentColor ?? "#1A73E8"}
                      onChange={(e) => setForm((f) => ({ ...f, invoiceAccentColor: e.target.value }))}
                      placeholder="#1A73E8"
                      className="flex-1 font-mono"
                    />
                  </div>
                  <p className="text-xs text-muted-foreground">Used for invoice headings, borders, and total row.</p>
                </div>
              </div>

              <Button onClick={saveInvoiceSettings} disabled={saving}>
                {saving ? <Loader2 className="mr-2 h-4 w-4 animate-spin" /> : <Save className="mr-2 h-4 w-4" />}
                Save invoice settings
              </Button>
            </CardContent>
          </Card>

          {/* Live preview */}
          <Card>
            <CardHeader>
              <CardTitle className="text-base flex items-center gap-2">
                <Eye className="h-4 w-4" /> Invoice preview
              </CardTitle>
              <CardDescription>How your invoice header + footer will look.</CardDescription>
            </CardHeader>
            <CardContent>
              <div className="rounded-lg border bg-white text-black overflow-hidden">
                {form.invoiceHeaderImage ? (
                  // eslint-disable-next-line @next/next/no-img-element
                  <img src={assetUrl(form.invoiceHeaderImage) ?? ""} alt="Header preview" className="w-full h-24 object-cover" />
                ) : (
                  <div className="h-16 flex items-center justify-center border-b" style={{ borderColor: form.invoiceAccentColor ?? "#1A73E8" }}>
                    <p className="text-sm font-bold" style={{ color: form.invoiceAccentColor ?? "#1A73E8" }}>
                      {form.name ?? "Your Business Name"}
                    </p>
                  </div>
                )}
                <div className="p-4">
                  <p className="text-xs text-gray-500 text-center">Invoice content goes here...</p>
                  <div className="mt-3 border-t pt-2">
                    <p className="text-xs text-gray-400 text-center">— Page 1 of N —</p>
                  </div>
                </div>
                {form.invoiceFooterImage ? (
                  // eslint-disable-next-line @next/next/no-img-element
                  <img src={assetUrl(form.invoiceFooterImage) ?? ""} alt="Footer preview" className="w-full h-16 object-cover" />
                ) : (
                  <div className="h-12 flex items-center justify-center border-t bg-gray-50">
                    <p className="text-xs text-gray-400">Thank you for your business!</p>
                  </div>
                )}
              </div>
            </CardContent>
          </Card>
        </TabsContent>

        {/* ── Account tab ── */}
        <TabsContent value="account" className="space-y-6">
          <Card>
            <CardHeader>
              <CardTitle className="text-base flex items-center gap-2">
                <User className="h-4 w-4" /> Display name
              </CardTitle>
              <CardDescription>Your name as shown in the sidebar + on invoices.</CardDescription>
            </CardHeader>
            <CardContent className="space-y-4">
              <div className="space-y-2">
                <Label htmlFor="email">Email (cannot change here)</Label>
                <Input id="email" value={session?.user?.email ?? ""} disabled />
                <p className="text-xs text-muted-foreground">Email changes require verification. Contact admin if needed.</p>
              </div>
              <div className="space-y-2">
                <Label htmlFor="userName">Display name *</Label>
                <Input id="userName" value={userName} onChange={(e) => setUserName(e.target.value)} />
              </div>
              <Button onClick={saveUserName} disabled={savingName || userName.length < 2}>
                {savingName ? <Loader2 className="mr-2 h-4 w-4 animate-spin" /> : <Save className="mr-2 h-4 w-4" />}
                Save name
              </Button>
            </CardContent>
          </Card>

          <Card>
            <CardHeader>
              <CardTitle className="text-base flex items-center gap-2">
                <Lock className="h-4 w-4" /> Change password
              </CardTitle>
              <CardDescription>Enter your current password + a new one.</CardDescription>
            </CardHeader>
            <CardContent className="space-y-4 max-w-md">
              <div className="space-y-2">
                <Label htmlFor="currentPassword">Current password *</Label>
                <Input id="currentPassword" type="password" value={currentPassword} onChange={(e) => setCurrentPassword(e.target.value)} />
              </div>
              <div className="space-y-2">
                <Label htmlFor="newPassword">New password *</Label>
                <Input id="newPassword" type="password" value={newPassword} onChange={(e) => setNewPassword(e.target.value)} placeholder="Min 6 characters" />
              </div>
              <div className="space-y-2">
                <Label htmlFor="confirmPassword">Confirm new password *</Label>
                <Input id="confirmPassword" type="password" value={confirmPassword} onChange={(e) => setConfirmPassword(e.target.value)} />
                {newPassword && confirmPassword && newPassword !== confirmPassword && (
                  <p className="text-xs text-red-600 flex items-center gap-1">
                    <AlertCircle className="h-3 w-3" /> Passwords don't match
                  </p>
                )}
              </div>
              <Button
                onClick={changePassword}
                disabled={changingPassword || !currentPassword || !newPassword || newPassword !== confirmPassword}
              >
                {changingPassword ? <Loader2 className="mr-2 h-4 w-4 animate-spin" /> : <Lock className="mr-2 h-4 w-4" />}
                Change password
              </Button>
            </CardContent>
          </Card>
        </TabsContent>
      </Tabs>
    </div>
  );
}
