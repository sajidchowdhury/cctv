"use client";

import Link from "next/link";
import { PageHeader } from "@/components/layout/page-header";
import { Card, CardContent, CardHeader, CardTitle, CardDescription } from "@/components/ui/card";
import { Badge } from "@/components/ui/badge";
import {
  Boxes, ShoppingCart, PackagePlus, TrendingUp, BookOpen, Users, Truck,
  Wallet, ArrowDownCircle, ArrowUpCircle, ReceiptText, Briefcase, ArrowLeftRight,
} from "lucide-react";

const REPORTS = [
  { href: "/reports/stock", title: "Stock Summary", desc: "Product-wise on-hand, value, low-stock", icon: Boxes, phase: "S09" },
  { href: "/reports/sales", title: "Sales Report", desc: "Invoice list, total sales, due, by salesman", icon: ShoppingCart, phase: "S18" },
  { href: "/reports/purchase", title: "Purchase Report", desc: "Invoice list, total purchase, supplier-wise", icon: PackagePlus, phase: "S18" },
  { href: "/reports/profit-loss", title: "Profit / Loss", desc: "Per invoice & aggregate: sales − cost − discount", icon: TrendingUp, phase: "S18" },
  { href: "/reports/customer-ledger", title: "Customer Ledger", desc: "Party-wise all transactions + running balance", icon: Users, phase: "S14" },
  { href: "/reports/supplier-ledger", title: "Supplier Ledger", desc: "Party-wise all transactions + running balance", icon: Truck, phase: "S07" },
  { href: "/reports/cash-book", title: "Cash Book", desc: "Day-wise cash in/out with closing balance", icon: Wallet, phase: "S15" },
  { href: "/reports/product-movement", title: "Product Movement", desc: "All IN/OUT movements per product with running stock", icon: ArrowLeftRight, phase: "F4" },
  { href: "/reports/income-expense", title: "Income / Expense", desc: "Account-head-wise summary (monthly)", icon: ReceiptText, phase: "S18" },
  { href: "/reports/salary-sheet", title: "Employee Salary Sheet", desc: "Monthly payroll summary", icon: Briefcase, phase: "S19" },
  { href: "/reports/warranty", title: "Warranty Expiry", desc: "Upcoming warranty ends by date window", icon: BookOpen, phase: "S19" },
];

export default function ReportsPage() {
  return (
    <div className="space-y-6">
      <PageHeader title="Reports" description="All 11 reports, printable + CSV export, date-range filters (doc §5.3)." />
      <div className="grid gap-4 sm:grid-cols-2 lg:grid-cols-3">
        {REPORTS.map((r) => {
          const Icon = r.icon;
          return (
            <Link key={r.href} href={r.href}>
              <Card className="hover:bg-accent hover:text-accent-foreground transition-colors h-full">
                <CardHeader>
                  <div className="flex items-center justify-between">
                    <div className="inline-flex h-10 w-10 items-center justify-center rounded-lg bg-primary/10 text-primary">
                      <Icon className="h-5 w-5" />
                    </div>
                    <Badge variant="outline" className="text-xs">{r.phase}</Badge>
                  </div>
                  <CardTitle className="text-base mt-2">{r.title}</CardTitle>
                  <CardDescription>{r.desc}</CardDescription>
                </CardHeader>
              </Card>
            </Link>
          );
        })}
      </div>
    </div>
  );
}
