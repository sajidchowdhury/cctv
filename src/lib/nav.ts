/**
 * Navigation config — the module list shown in the sidebar + bottom nav.
 *
 * Doc §6: bottom nav on mobile (Home, Sales, Purchase, Ledger, More);
 * desktop sidebar with the full module list.
 *
 * `mobile` flag marks the 5 bottom-nav slots. `roles` restricts visibility
 * (e.g. accounting hidden from SALESMAN). Modules are added per phase as
 * their routes land.
 */
import type { Role } from "@/lib/tenant-context";
import {
  LayoutDashboard,
  ShoppingCart,
  PackagePlus,
  BookOpen,
  Boxes,
  Users,
  Truck,
  FileText,
  ShieldCheck,
  Wrench,
  Bell,
  ReceiptText,
  type LucideIcon,
} from "lucide-react";

export type NavItem = {
  href: string;
  label: string;
  labelBn: string; // Bangla (S23 i18n full bundle)
  icon: LucideIcon;
  mobile?: boolean; // appears in mobile bottom nav
  roles?: Role[]; // restrict visibility; undefined = all roles
  phase: string; // when the module lands
};

export const NAV_ITEMS: NavItem[] = [
  {
    href: "/",
    label: "Home",
    labelBn: "হোম",
    icon: LayoutDashboard,
    mobile: true,
    phase: "S04",
  },
  {
    href: "/sales",
    label: "Sales",
    labelBn: "সেলস",
    icon: ShoppingCart,
    mobile: true,
    phase: "S11",
  },
  {
    href: "/purchases",
    label: "Purchase",
    labelBn: "ক্রয়",
    icon: PackagePlus,
    mobile: true,
    phase: "S08",
  },
  {
    href: "/ledger",
    label: "Ledger",
    labelBn: "হিসাব",
    icon: BookOpen,
    mobile: true,
    roles: ["OWNER", "MANAGER", "ACCOUNTANT"],
    phase: "S15",
  },
  {
    href: "/products",
    label: "Products",
    labelBn: "পণ্য",
    icon: Boxes,
    mobile: true,
    phase: "S06",
  },
  {
    href: "/customers",
    label: "Customers",
    labelBn: "কাস্টমার",
    icon: Users,
    phase: "S14",
  },
  {
    href: "/suppliers",
    label: "Suppliers",
    labelBn: "সাপ্লায়ার",
    icon: Truck,
    phase: "S07",
  },
  {
    href: "/stock",
    label: "Stock",
    labelBn: "স্টক",
    icon: Boxes,
    phase: "S09",
  },
  {
    href: "/quotations",
    label: "Quotations",
    labelBn: "কোটেশন",
    icon: FileText,
    phase: "S10",
  },
  {
    href: "/warranty",
    label: "Warranty",
    labelBn: "ওয়ারেন্টি",
    icon: ShieldCheck,
    phase: "S12",
  },
  {
    href: "/rma",
    label: "RMA",
    labelBn: "আরএমএ",
    icon: Wrench,
    phase: "S21",
  },
  {
    href: "/reminders",
    label: "Reminders",
    labelBn: "রিমাইন্ডার",
    icon: Bell,
    phase: "S22",
  },
  {
    href: "/reports",
    label: "Reports",
    labelBn: "রিপোর্ট",
    icon: ReceiptText,
    roles: ["OWNER", "MANAGER", "ACCOUNTANT"],
    phase: "S18",
  },
];

/** The 5 slots in the mobile bottom nav (doc §6). */
export const MOBILE_NAV_ITEMS = NAV_ITEMS.filter((i) => i.mobile);

/** Items visible to a given role (hides accounting etc. from SALESMAN). */
export function visibleNavItems(role: Role | undefined): NavItem[] {
  if (!role) return NAV_ITEMS;
  return NAV_ITEMS.filter((i) => !i.roles || i.roles.includes(role));
}
