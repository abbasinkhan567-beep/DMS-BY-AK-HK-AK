"use client";

import Link from "next/link";
import { usePathname } from "next/navigation";
import {
  LayoutDashboard,
  Package,
  ShoppingCart,
  Users,
  UserCheck,
  Truck,
  Menu,
  X,
  ChevronDown,
  Droplets,
  Settings,
  BookOpen,
  Wallet,
  BookMarked,
  ArrowLeftRight,
  SlidersHorizontal,
  TrendingUp,
  FileText,
} from "lucide-react";
import { useState } from "react";
import { cn } from "@/lib/utils";
import { CreditsWatermark } from "@/components/CreditsWatermark";
import { useTheme } from "@/components/ThemeProvider";

const mainLinks = [
  { href: "/", label: "Dashboard", icon: LayoutDashboard },
  { href: "/income", label: "Income", icon: TrendingUp },
  { href: "/paper-entry", label: "Paper / Old Records", icon: FileText },
];

const businessLinks = [
  { href: "/products", label: "Products", icon: Package },
  { href: "/purchases", label: "Purchases", icon: Truck },
  { href: "/sales", label: "Sales", icon: ShoppingCart },
  { href: "/customers", label: "Customers", icon: Users },
  { href: "/salesmen", label: "Salesmen", icon: UserCheck },
  { href: "/expenses", label: "Expenses", icon: Wallet },
  { href: "/general-entry", label: "General Entry", icon: BookMarked },
  { href: "/ledgers", label: "Ledgers", icon: BookOpen },
  { href: "/stock-transfer", label: "Stock Transfer", icon: ArrowLeftRight },
  { href: "/stock-adjustment", label: "Stock Adjustment", icon: SlidersHorizontal },
  { href: "/settings", label: "Settings", icon: Settings },
];

export function Sidebar() {
  const pathname = usePathname();
  const [open, setOpen] = useState(false);
  const [opsOpen, setOpsOpen] = useState(true);
  const { theme } = useTheme();
  const isPepsi = theme === "pepsi";

  const NavItem = ({
    href,
    label,
    icon: Icon,
  }: {
    href: string;
    label: string;
    icon: React.ComponentType<{ size?: number; className?: string }>;
  }) => {
    const active = pathname === href;
    return (
      <Link
        href={href}
        onClick={() => setOpen(false)}
        className={cn(
          "relative flex items-center gap-3 rounded-xl px-3 py-2.5 text-sm font-medium transition",
          active
            ? "bg-white/15 text-white shadow-sm"
            : "text-white/75 hover:bg-white/10 hover:text-white"
        )}
      >
        {active && (
          <span className="absolute left-0 top-1/2 h-7 w-1 -translate-y-1/2 rounded-r-full bg-white" />
        )}
        <Icon size={18} className="shrink-0" />
        {label}
      </Link>
    );
  };

  return (
    <>
      <button
        type="button"
        className="fixed left-4 top-4 z-50 rounded-xl bg-brand-600 p-2.5 text-white shadow-soft lg:hidden"
        onClick={() => setOpen(true)}
        aria-label="Open menu"
      >
        <Menu size={20} />
      </button>

      {open && (
        <button
          type="button"
          className="fixed inset-0 z-40 bg-slate-900/40 backdrop-blur-[2px] lg:hidden"
          onClick={() => setOpen(false)}
          aria-label="Close overlay"
        />
      )}

      <aside
        className={cn(
          "sidebar-shell fixed inset-y-0 left-0 z-50 flex w-[260px] flex-col bg-brand-600 text-white transition-transform lg:static lg:translate-x-0",
          open ? "translate-x-0" : "-translate-x-full"
        )}
      >
        <div className={cn("h-1 w-full pepsi-stripe", isPepsi ? "opacity-100" : "opacity-0")} />
        <div className="flex items-center justify-between px-5 pb-2 pt-5">
          <div className="flex items-center gap-3">
            <span className="relative inline-flex h-11 w-11 items-center justify-center rounded-full bg-white text-brand-600 shadow-sm">
              <Droplets size={22} />
              {isPepsi && (
                <span className="absolute -bottom-0.5 -right-0.5 h-3.5 w-3.5 rounded-full border-2 border-brand-600 bg-accent" />
              )}
            </span>
            <div>
              <p className="text-[15px] font-bold tracking-tight">Pepsi Dist.</p>
              <p className="text-[11px] text-white/60">Admin Portal</p>
            </div>
          </div>
          <button
            type="button"
            className="rounded-lg p-1 hover:bg-white/10 lg:hidden"
            onClick={() => setOpen(false)}
            aria-label="Close menu"
          >
            <X size={18} />
          </button>
        </div>

        <nav className="mt-4 flex-1 space-y-1 overflow-y-auto px-3 pb-4">
          {mainLinks.map((link) => (
            <NavItem key={link.href} {...link} />
          ))}

          <button
            type="button"
            onClick={() => setOpsOpen((v) => !v)}
            className="mt-3 flex w-full items-center justify-between rounded-xl px-3 py-2.5 text-sm font-medium text-white/75 hover:bg-white/10 hover:text-white"
          >
            <span className="flex items-center gap-3">
              <Package size={18} />
              Operations
            </span>
            <ChevronDown size={16} className={cn("transition", opsOpen ? "rotate-180" : "")} />
          </button>

          {opsOpen && (
            <div className="ml-2 space-y-1 border-l border-white/15 pl-2">
              {businessLinks.map((link) => (
                <NavItem key={link.href} {...link} />
              ))}
            </div>
          )}
        </nav>

        <CreditsWatermark variant="sidebar" />
      </aside>
    </>
  );
}
