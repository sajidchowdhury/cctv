"use client";

import Link from "next/link";
import { useSession } from "next-auth/react";
import { Button } from "@/components/ui/button";
import { Badge } from "@/components/ui/badge";
import {
  ShieldCheck, ShoppingCart, PackagePlus, BookOpen, Boxes, Users, Truck,
  FileText, Wrench, Bell, ReceiptText, CreditCard, ArrowRight, Check,
  Zap, Smartphone, Globe, Lock, TrendingUp, Package, ScanLine,
} from "lucide-react";

const FEATURES = [
  {
    icon: ShoppingCart,
    title: "Sales & Invoicing",
    desc: "Create invoices with serial capture, barcode scan, auto stock check, held carts, and custom invoice branding.",
    color: "text-blue-600 dark:text-blue-400",
    bg: "bg-blue-50 dark:bg-blue-950/30",
  },
  {
    icon: PackagePlus,
    title: "Purchase Management",
    desc: "Record purchases with serial numbers, auto stock-in, supplier balance tracking, and inline supplier creation.",
    color: "text-amber-600 dark:text-amber-400",
    bg: "bg-amber-50 dark:bg-amber-950/30",
  },
  {
    icon: Boxes,
    title: "Stock Control",
    desc: "Serialised + qty-based stock tracking, low-stock alerts, stock-by-category/model reports, real-time on-hand.",
    color: "text-emerald-600 dark:text-emerald-400",
    bg: "bg-emerald-50 dark:bg-emerald-950/30",
  },
  {
    icon: BookOpen,
    title: "Accounting & Cash Book",
    desc: "Single-entry income/expense, account heads, cash book with running balance, customer/supplier ledgers.",
    color: "text-purple-600 dark:text-purple-400",
    bg: "bg-purple-50 dark:bg-purple-950/30",
  },
  {
    icon: ShieldCheck,
    title: "Warranty Tracking",
    desc: "Warranty lookup by serial, full product history (purchase, sale, RMA), warranty card PDF + SMS.",
    color: "text-rose-600 dark:text-rose-400",
    bg: "bg-rose-50 dark:bg-rose-950/30",
  },
  {
    icon: Wrench,
    title: "RMA Pipeline",
    desc: "5-stage return merchandise authorization, auto-warranty check, SMS on each transition, timestamped history.",
    color: "text-violet-600 dark:text-violet-400",
    bg: "bg-violet-50 dark:bg-violet-950/30",
  },
  {
    icon: FileText,
    title: "Quotations",
    desc: "Build quotes with product/labor/service lines, convert to sale with serial picker, track win/loss.",
    color: "text-cyan-600 dark:text-cyan-400",
    bg: "bg-cyan-50 dark:bg-cyan-950/30",
  },
  {
    icon: Bell,
    title: "Reminders & Alerts",
    desc: "Bill renewals, warranty expiry, salary, follow-ups — worker dispatches SMS automatically.",
    color: "text-orange-600 dark:text-orange-400",
    bg: "bg-orange-50 dark:bg-orange-950/30",
  },
  {
    icon: ReceiptText,
    title: "16+ Reports",
    desc: "Sales, purchase, profit/loss, stock, cash book, ledgers, salary, warranty — all paginated + searchable.",
    color: "text-teal-600 dark:text-teal-400",
    bg: "bg-teal-50 dark:bg-teal-950/30",
  },
];

const STATS = [
  { value: "25+", label: "Sessions built" },
  { value: "16+", label: "Report types" },
  { value: "5", label: "RMA stages" },
  { value: "∞", label: "Products supported" },
];

export default function LandingPage() {
  const { data: session } = useSession();
  const isLoggedIn = !!session?.user;

  return (
    <div className="min-h-screen bg-gradient-to-br from-slate-50 to-slate-100 dark:from-slate-950 dark:to-slate-900">
      {/* ── Nav bar ── */}
      <nav className="sticky top-0 z-50 backdrop-blur-md bg-white/80 dark:bg-slate-950/80 border-b">
        <div className="mx-auto max-w-6xl flex items-center justify-between px-4 py-3">
          <div className="flex items-center gap-2">
            <div className="inline-flex h-9 w-9 items-center justify-center rounded-xl bg-primary text-primary-foreground">
              <ShieldCheck className="h-5 w-5" />
            </div>
            <span className="font-bold text-lg">CCTV InventoryOS</span>
          </div>
          <div className="flex items-center gap-2">
            {isLoggedIn ? (
              <Button asChild>
                <Link href="/dashboard">Go to Dashboard <ArrowRight className="ml-2 h-4 w-4" /></Link>
              </Button>
            ) : (
              <>
                <Button asChild variant="ghost" size="sm" className="hidden sm:flex">
                  <Link href="/login">Sign in</Link>
                </Button>
                <Button asChild size="sm">
                  <Link href="/login">Get Started <ArrowRight className="ml-2 h-4 w-4" /></Link>
                </Button>
              </>
            )}
          </div>
        </div>
      </nav>

      {/* ── Hero section ── */}
      <section className="relative overflow-hidden">
        <div className="absolute inset-0 bg-grid-pattern opacity-[0.03]" />
        <div className="mx-auto max-w-4xl px-4 py-20 md:py-28 text-center relative">
          <Badge variant="secondary" className="mb-4 bg-primary/10 text-primary border-primary/20">
            <Zap className="mr-1 h-3 w-3" /> Built for CCTV businesses in Bangladesh
          </Badge>
          <h1 className="text-4xl md:text-6xl font-bold tracking-tight mb-4 bg-gradient-to-r from-slate-900 to-slate-600 dark:from-white dark:to-slate-400 bg-clip-text text-transparent">
            Run your CCTV shop
            <br />
            <span className="text-primary">on autopilot</span>
          </h1>
          <p className="text-lg text-muted-foreground max-w-2xl mx-auto mb-8">
            From purchase to sale, stock to warranty, accounting to reminders —
            everything in one place. Serial-level tracking, barcode scanning,
            custom invoices, and 16+ reports.
          </p>
          <div className="flex flex-col sm:flex-row items-center justify-center gap-3">
            <Button asChild size="lg" className="min-w-[200px]">
              <Link href="/login">
                {isLoggedIn ? "Go to Dashboard" : "Login to Start"}
                <ArrowRight className="ml-2 h-5 w-5" />
              </Link>
            </Button>
            <Button asChild variant="outline" size="lg">
              <Link href="#features">Explore Features</Link>
            </Button>
          </div>

          {/* Stats */}
          <div className="grid grid-cols-2 md:grid-cols-4 gap-4 mt-16 max-w-3xl mx-auto">
            {STATS.map((s) => (
              <div key={s.label} className="text-center">
                <p className="text-3xl md:text-4xl font-bold text-primary tabular-nums">{s.value}</p>
                <p className="text-xs text-muted-foreground mt-1">{s.label}</p>
              </div>
            ))}
          </div>
        </div>
      </section>

      {/* ── Features grid ── */}
      <section id="features" className="mx-auto max-w-6xl px-4 py-16">
        <div className="text-center mb-12">
          <h2 className="text-3xl font-bold mb-2">Everything you need</h2>
          <p className="text-muted-foreground">A complete toolkit for CCTV retail & service</p>
        </div>

        <div className="grid gap-4 sm:grid-cols-2 lg:grid-cols-3">
          {FEATURES.map((f) => {
            const Icon = f.icon;
            return (
              <div
                key={f.title}
                className="group rounded-2xl border bg-card p-6 hover:shadow-lg transition-all hover:-translate-y-0.5"
              >
                <div className={`inline-flex h-12 w-12 items-center justify-center rounded-xl ${f.bg} ${f.color} mb-4`}>
                  <Icon className="h-6 w-6" />
                </div>
                <h3 className="font-semibold text-lg mb-1">{f.title}</h3>
                <p className="text-sm text-muted-foreground leading-relaxed">{f.desc}</p>
              </div>
            );
          })}
        </div>
      </section>

      {/* ── Highlight: Serial tracking + barcode ── */}
      <section className="bg-primary/5 border-y">
        <div className="mx-auto max-w-4xl px-4 py-16">
          <div className="grid md:grid-cols-2 gap-8 items-center">
            <div>
              <div className="inline-flex items-center gap-2 text-primary mb-3">
                <ScanLine className="h-5 w-5" />
                <span className="font-semibold">Serial-Level Tracking</span>
              </div>
              <h3 className="text-2xl font-bold mb-3">
                Track every camera, DVR & NVR by serial number
              </h3>
              <p className="text-muted-foreground mb-4">
                Scan barcodes to instantly add items to cart. Auto-detect scans,
                auto-add the exact serial, and see all available units at a glance.
                Every product carries its full lifecycle — purchase, sale, warranty, RMA.
              </p>
              <ul className="space-y-2">
                {[
                  "Barcode scanner support with auto-add to cart",
                  "Grouped invoice display: MODEL (NAME) / S1, S2, S3",
                  "Warranty lookup by serial — full history in one click",
                  "RMA pipeline with 5-stage tracking",
                ].map((item) => (
                  <li key={item} className="flex items-start gap-2 text-sm">
                    <Check className="h-4 w-4 text-emerald-500 shrink-0 mt-0.5" />
                    <span>{item}</span>
                  </li>
                ))}
              </ul>
            </div>
            <div className="rounded-2xl border bg-white dark:bg-slate-900 p-6 shadow-lg">
              <div className="space-y-3">
                <div className="flex items-center justify-between pb-3 border-b">
                  <div>
                    <p className="font-medium text-sm">DH-IPC-HFW2431T</p>
                    <p className="text-xs text-muted-foreground">(Dahua 4MP Dome Camera)</p>
                  </div>
                  <Badge variant="secondary" className="bg-emerald-100 text-emerald-700">3 in stock</Badge>
                </div>
                <div className="flex flex-wrap gap-1">
                  {["SN001", "SN002", "SN003"].map((s) => (
                    <span key={s} className="rounded-md border border-blue-200 bg-blue-50 dark:bg-blue-950/30 dark:border-blue-900 px-2 py-0.5 text-xs font-mono text-blue-700 dark:text-blue-300">
                      {s}
                    </span>
                  ))}
                </div>
                <div className="pt-3 border-t flex items-center gap-2">
                  <ScanLine className="h-4 w-4 text-muted-foreground" />
                  <span className="text-xs text-muted-foreground font-mono">Scan serial to auto-add →</span>
                </div>
              </div>
            </div>
          </div>
        </div>
      </section>

      {/* ── Highlight: Custom invoices ── */}
      <section className="mx-auto max-w-4xl px-4 py-16">
        <div className="grid md:grid-cols-2 gap-8 items-center">
          <div className="order-2 md:order-1 rounded-2xl border bg-white dark:bg-slate-900 p-6 shadow-lg">
            <div className="border-b pb-3 mb-3">
              <p className="font-bold text-lg text-primary">Your Business Name</p>
              <p className="text-xs text-muted-foreground">+880 1XXX-XXXXXX · Shop address</p>
            </div>
            <div className="space-y-1 text-sm">
              <div className="flex justify-between"><span>Dahua Camera x2</span><span className="tabular-nums">5,000</span></div>
              <div className="flex justify-between"><span>HDMI Cable x5</span><span className="tabular-nums">750</span></div>
              <div className="flex justify-between"><span>Installation</span><span className="tabular-nums">1,000</span></div>
              <div className="flex justify-between font-bold border-t pt-1 mt-1"><span>Total</span><span className="tabular-nums text-primary">6,750</span></div>
            </div>
            <div className="mt-3 pt-3 border-t text-center">
              <p className="text-xs text-muted-foreground">Thank you for your business!</p>
            </div>
          </div>
          <div className="order-1 md:order-2">
            <div className="inline-flex items-center gap-2 text-primary mb-3">
              <ReceiptText className="h-5 w-5" />
              <span className="font-semibold">Custom Invoices</span>
            </div>
            <h3 className="text-2xl font-bold mb-3">
              Brand every invoice with your logo & colors
            </h3>
            <p className="text-muted-foreground mb-4">
              Upload your business logo, custom header/footer images, and pick your
              accent color. Items are grouped by product model with serials listed
              below — clean, professional, and uniquely yours.
            </p>
            <ul className="space-y-2">
              {[
                "Custom header & footer images",
                "Business name + logo on every invoice",
                "Accent color for headings & borders",
                "Grouped items: MODEL (NAME) / S1, S2, S3",
                "Pagination for large invoices",
              ].map((item) => (
                <li key={item} className="flex items-start gap-2 text-sm">
                  <Check className="h-4 w-4 text-emerald-500 shrink-0 mt-0.5" />
                  <span>{item}</span>
                </li>
              ))}
            </ul>
          </div>
        </div>
      </section>

      {/* ── Platform highlights ── */}
      <section className="bg-slate-50 dark:bg-slate-900/50 border-y">
        <div className="mx-auto max-w-4xl px-4 py-16">
          <div className="grid sm:grid-cols-3 gap-6">
            {[
              { icon: Smartphone, title: "Mobile-first", desc: "Designed for 360px first. Works perfectly on phones, tablets, and desktops." },
              { icon: Globe, title: "Bangla + English", desc: "Full i18n with Bangla translations. Toggle language anytime." },
              { icon: Lock, title: "Tenant-isolated", desc: "Multi-tenant architecture. Your data is yours — no cross-tenant leaks." },
            ].map((p) => {
              const Icon = p.icon;
              return (
                <div key={p.title} className="text-center">
                  <div className="inline-flex h-12 w-12 items-center justify-center rounded-xl bg-primary/10 text-primary mb-3">
                    <Icon className="h-6 w-6" />
                  </div>
                  <h3 className="font-semibold mb-1">{p.title}</h3>
                  <p className="text-sm text-muted-foreground">{p.desc}</p>
                </div>
              );
            })}
          </div>
        </div>
      </section>

      {/* ── CTA ── */}
      <section className="mx-auto max-w-4xl px-4 py-20 text-center">
        <h2 className="text-3xl font-bold mb-4">Ready to get started?</h2>
        <p className="text-muted-foreground mb-8 max-w-xl mx-auto">
          Login to access your dashboard, or sign up if you're new. Your first
          month includes full access to all features.
        </p>
        <div className="flex flex-col sm:flex-row items-center justify-center gap-3">
          <Button asChild size="lg" className="min-w-[200px]">
            <Link href="/login">
              {isLoggedIn ? "Go to Dashboard" : "Login"}
              <ArrowRight className="ml-2 h-5 w-5" />
            </Link>
          </Button>
          {!isLoggedIn && (
            <Button asChild variant="outline" size="lg">
              <Link href="/signup">Create account</Link>
            </Button>
          )}
        </div>
      </section>

      {/* ── Footer ── */}
      <footer className="border-t bg-card">
        <div className="mx-auto max-w-6xl px-4 py-8 flex flex-col sm:flex-row items-center justify-between gap-4">
          <div className="flex items-center gap-2">
            <div className="inline-flex h-7 w-7 items-center justify-center rounded-lg bg-primary text-primary-foreground">
              <ShieldCheck className="h-4 w-4" />
            </div>
            <span className="font-semibold text-sm">CCTV InventoryOS</span>
          </div>
          <p className="text-xs text-muted-foreground text-center">
            Made with love &amp; coffee by{" "}
            <a
              href="https://mycreativecode.com"
              target="_blank"
              rel="noopener noreferrer"
              className="font-medium text-foreground hover:underline"
            >
              my creative code
            </a>
          </p>
        </div>
      </footer>
    </div>
  );
}
