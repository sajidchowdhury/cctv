/**
 * i18n — Bangla/English translation system (doc §6).
 *
 * Uses a Zustand store + localStorage for persistence. A `t(key)` function
 * looks up the string in the active language's dictionary.
 *
 * Message bundles cover: navigation, common UI (buttons, labels, headings),
 * dashboard, auth pages, and module-specific strings.
 *
 * The nav.ts `labelBn` fields feed the sidebar/bottom-nav labels directly.
 */

export type Language = "en" | "bn";

// ─── English bundle ─────────────────────────────────────────────
const en: Record<string, string> = {
  // Common
  "common.save": "Save",
  "common.cancel": "Cancel",
  "common.delete": "Delete",
  "common.back": "Back",
  "common.search": "Search",
  "common.new": "New",
  "common.export": "Export CSV",
  "common.print": "Print",
  "common.loading": "Loading…",
  "common.confirm": "Confirm",
  "common.yes": "Yes",
  "common.no": "No",
  "common.actions": "Actions",
  "common.status": "Status",
  "common.date": "Date",
  "common.amount": "Amount",
  "common.total": "Total",
  "common.due": "Due",
  "common.paid": "Paid",
  "common.mode": "Mode",
  "common.notes": "Notes",
  "common.type": "Type",
  "common.name": "Name",
  "common.phone": "Phone",
  "common.address": "Address",
  "common.role": "Role",
  "common.active": "Active",
  "common.all": "All",

  // Dashboard
  "dashboard.title": "Dashboard",
  "dashboard.welcome": "Welcome",
  "dashboard.overview": "Your workspace overview.",
  "dashboard.stockValue": "Stock value",
  "dashboard.unitsOnHand": "Units on hand",
  "dashboard.lowStockItems": "Low-stock items",
  "dashboard.subscription": "Subscription",
  "dashboard.quickActions": "Quick actions",
  "dashboard.lowStock": "Low stock",
  "dashboard.upcomingReminders": "Upcoming reminders",
  "dashboard.viewAll": "View all",
  "dashboard.noLowStock": "No low-stock alerts",
  "dashboard.noReminders": "No reminders due today",
  "dashboard.allCaughtUp": "All caught up. Check reminders for upcoming dues.",

  // Auth
  "auth.welcomeBack": "Welcome back",
  "auth.loginPrompt": "Log in to your CCTV Inventory workspace.",
  "auth.logIn": "Log in",
  "auth.signUp": "Sign up",
  "auth.email": "Email",
  "auth.password": "Password",
  "auth.createWorkspace": "Create your workspace",
  "auth.noAccount": "No account?",
  "auth.haveAccount": "Already have an account?",
  "auth.verifyEmail": "Verify your email",
  "auth.activateSubscription": "Activate your subscription",

  // Modules
  "module.products": "Products",
  "module.purchases": "Purchases",
  "module.sales": "Sales",
  "module.customers": "Customers",
  "module.suppliers": "Suppliers",
  "module.stock": "Stock",
  "module.quotations": "Quotations",
  "module.warranty": "Warranty",
  "module.rma": "Vendor RMA",
  "module.reminders": "Reminders",
  "module.reports": "Reports",
  "module.ledger": "Accounting",
  "module.employees": "Employees",

  // Page descriptions
  "desc.products": "Catalogue of CCTV items your business trades.",
  "desc.sales": "Cart-based invoicing with live stock + due ledger.",
  "desc.purchases": "Stock-in invoices with serial capture.",
  "desc.customers": "Buyers with receivable balances + sales attribution.",
  "desc.suppliers": "Vendors you purchase CCTV stock from.",
  "desc.stock": "Product-wise on-hand quantity, value, and low-stock flags.",
  "desc.quotations": "Pre-sale project estimation with convert-to-sale.",
  "desc.warranty": "Look up a sold unit by serial number to check warranty status.",
  "desc.rma": "5-stage repair pipeline with timestamped history.",
  "desc.reminders": "Unified reminder engine + SMS dispatch.",
  "desc.reports": "All 10 reports, printable + CSV export, date-range filters.",
  "desc.ledger": "Income, expense, and cash book.",
  "desc.employees": "Staff master + monthly payroll.",

  // Language toggle
  "lang.toggle": "বাংলা",
  "lang.english": "English",
  "lang.bangla": "বাংলা",
};

// ─── Bangla bundle ─────────────────────────────────────────────
const bn: Record<string, string> = {
  // Common
  "common.save": "সংরক্ষণ",
  "common.cancel": "বাতিল",
  "common.delete": "মুছুন",
  "common.back": "পিছনে",
  "common.search": "খুঁজুন",
  "common.new": "নতুন",
  "common.export": "CSV ডাউনলোড",
  "common.print": "প্রিন্ট",
  "common.loading": "লোড হচ্ছে…",
  "common.confirm": "নিশ্চিত করুন",
  "common.yes": "হ্যাঁ",
  "common.no": "না",
  "common.actions": "অ্যাকশন",
  "common.status": "অবস্থা",
  "common.date": "তারিখ",
  "common.amount": "পরিমাণ",
  "common.total": "মোট",
  "common.due": "বাকি",
  "common.paid": "পরিশোধিত",
  "common.mode": "মোড",
  "common.notes": "নোট",
  "common.type": "ধরন",
  "common.name": "নাম",
  "common.phone": "ফোন",
  "common.address": "ঠিকানা",
  "common.role": "ভূমিকা",
  "common.active": "সক্রিয়",
  "common.all": "সব",

  // Dashboard
  "dashboard.title": "ড্যাশবোর্ড",
  "dashboard.welcome": "স্বাগতম",
  "dashboard.overview": "আপনার ওয়ার্কস্পেস ওভারভিউ।",
  "dashboard.stockValue": "স্টক মূল্য",
  "dashboard.unitsOnHand": "মজুত ইউনিট",
  "dashboard.lowStockItems": "কম স্টকের আইটেম",
  "dashboard.subscription": "সাবস্ক্রিপশন",
  "dashboard.quickActions": "দ্রুত অ্যাকশন",
  "dashboard.lowStock": "কম স্টক",
  "dashboard.upcomingReminders": "আসন্ন রিমাইন্ডার",
  "dashboard.viewAll": "সব দেখুন",
  "dashboard.noLowStock": "কোন কম স্টক সতর্কতা নেই",
  "dashboard.noReminders": "আজ কোন রিমাইন্ডার নেই",
  "dashboard.allCaughtUp": "সব ঠিক আছে। আসন্ন ডিউগুলোর জন্য রিমাইন্ডার চেক করুন।",

  // Auth
  "auth.welcomeBack": "ফিরে এলেন",
  "auth.loginPrompt": "আপনার CCTV ইনভেন্টরি ওয়ার্কস্পেসে লগইন করুন।",
  "auth.logIn": "লগইন",
  "auth.signUp": "সাইন আপ",
  "auth.email": "ইমেইল",
  "auth.password": "পাসওয়ার্ড",
  "auth.createWorkspace": "আপনার ওয়ার্কস্পেস তৈরি করুন",
  "auth.noAccount": "অ্যাকাউন্ট নেই?",
  "auth.haveAccount": "ইতিমধ্যে অ্যাকাউন্ট আছে?",
  "auth.verifyEmail": "ইমেইল যাচাই করুন",
  "auth.activateSubscription": "আপনার সাবস্ক্রিপশন সক্রিয় করুন",

  // Modules
  "module.products": "পণ্য",
  "module.purchases": "ক্রয়",
  "module.sales": "সেলস",
  "module.customers": "কাস্টমার",
  "module.suppliers": "সাপ্লায়ার",
  "module.stock": "স্টক",
  "module.quotations": "কোটেশন",
  "module.warranty": "ওয়ারেন্টি",
  "module.rma": "ভেন্ডর RMA",
  "module.reminders": "রিমাইন্ডার",
  "module.reports": "রিপোর্ট",
  "module.ledger": "হিসাব",
  "module.employees": "কর্মচারী",

  // Page descriptions
  "desc.products": "আপনার ব্যবসার CCTV আইটেমগুলোর তালিকা।",
  "desc.sales": "কার্ট-ভিত্তিক ইনভয়েসিং এবং লাইভ স্টক।",
  "desc.purchases": "সিরিয়াল ক্যাপচার সহ স্টক-ইন ইনভয়েস।",
  "desc.customers": "পাওনাদার ব্যালেন্স এবং সেলস অ্যাট্রিবিউশন।",
  "desc.suppliers": "যাদের থেকে আপনি CCTV স্টক কেনেন।",
  "desc.stock": "পণ্যভিত্তিক মজুত পরিমাণ, মূল্য এবং কম স্টক ফ্ল্যাগ।",
  "desc.quotations": "প্রি-সেল প্রজেক্ট এস্টিমেশন এবং কনভার্ট-টু-সেল।",
  "desc.warranty": "সিরিয়াল নম্বর দিয়ে বিক্রিত ইউনিটের ওয়ারেন্টি যাচাই।",
  "desc.rma": "টাইমস্ট্যাম্পড হিস্ট্রি সহ ৫-ধাপের রিপেয়ার পাইপলাইন।",
  "desc.reminders": "একীভূত রিমাইন্ডার ইঞ্জিন এবং SMS প্রেরণ।",
  "desc.reports": "১০টি রিপোর্ট, প্রিন্টযোগ্য + CSV এক্সপোর্ট।",
  "desc.ledger": "আয়, ব্যয় এবং ক্যাশ বুক।",
  "desc.employees": "কর্মী তালিকা এবং মাসিক পেরোল।",

  // Language toggle
  "lang.toggle": "English",
  "lang.english": "English",
  "lang.bangla": "বাংলা",
};

const bundles: Record<Language, Record<string, string>> = { en, bn };

/**
 * Translate a key. Falls back to English if the key is missing in Bangla,
 * then to the key itself if missing entirely.
 */
export function translate(lang: Language, key: string): string {
  return bundles[lang]?.[key] ?? bundles.en?.[key] ?? key;
}
