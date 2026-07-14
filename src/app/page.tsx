"use client";

import { useEffect, useState } from "react";
import Link from "next/link";
import {
  Settings,
  Package,
  Truck,
  ShoppingCart,
  Users,
  UserCheck,
  Wallet,
  BookMarked,
  BookOpen,
  ArrowLeftRight,
  SlidersHorizontal,
  TrendingUp,
  FileText,
} from "lucide-react";
import { formatMoney } from "@/lib/utils";
import { Button, Card } from "@/components/ui";

type DashboardData = {
  stockValue: number;
  lowStock: number;
  todaySales: number;
  todayPurchase: number;
  customerBalance: number;
  productCount: number;
  customerCount: number;
  salesmanCount: number;
};

const modules = [
  { href: "/income", label: "Income", desc: "Daily / Monthly / Yearly", icon: TrendingUp },
  { href: "/paper-entry", label: "Paper Records", desc: "Old forms by date", icon: FileText },
  { href: "/products", label: "Products", desc: "Stock & rates", icon: Package },
  { href: "/purchases", label: "Purchases", desc: "Buy from company", icon: Truck },
  { href: "/sales", label: "Sales", desc: "Bills & commission", icon: ShoppingCart },
  { href: "/customers", label: "Customers", desc: "Shops & receivables", icon: Users },
  { href: "/salesmen", label: "Salesmen", desc: "Sales team", icon: UserCheck },
  { href: "/expenses", label: "Expenses", desc: "Daily expenses", icon: Wallet },
  { href: "/general-entry", label: "General Entry", desc: "Daybook & accounts", icon: BookMarked },
  { href: "/ledgers", label: "Ledgers", desc: "Company / Floor", icon: BookOpen },
  { href: "/stock-transfer", label: "Stock Transfer", desc: "Warehouse shift", icon: ArrowLeftRight },
  { href: "/stock-adjustment", label: "Stock Adjustment", desc: "Correct quantity", icon: SlidersHorizontal },
  { href: "/settings", label: "Settings", desc: "Company & backup", icon: Settings },
];

export default function DashboardPage() {
  const [data, setData] = useState<DashboardData | null>(null);

  useEffect(() => {
    fetch("/api/dashboard")
      .then((r) => r.json())
      .then(setData)
      .catch(console.error);
  }, []);

  if (!data) {
    return (
      <div className="flex h-64 items-center justify-center text-sm text-slate-500">
        Loading dashboard...
      </div>
    );
  }

  return (
    <div className="space-y-5">
      <div className="flex flex-wrap items-center justify-between gap-3">
        <div>
          <h1 className="text-xl font-bold text-slate-800 sm:text-2xl">Dashboard</h1>
        </div>
        <Link href="/settings">
          <Button variant="secondary">
            <Settings size={16} /> Settings
          </Button>
        </Link>
      </div>

      <div className="grid gap-4 sm:grid-cols-2 xl:grid-cols-4">
        {[
          { label: "Today Sales", value: formatMoney(data.todaySales) },
          { label: "Stock Value", value: formatMoney(data.stockValue) },
          { label: "Pending", value: formatMoney(data.customerBalance) },
          { label: "Low Stock", value: String(data.lowStock) },
        ].map((s) => (
          <div key={s.label} className="card px-5 py-4">
            <p className="text-xs font-semibold uppercase tracking-wide text-slate-400">
              {s.label}
            </p>
            <p className="mt-2 text-2xl font-bold text-slate-800">{s.value}</p>
          </div>
        ))}
      </div>

      <Card title="Quick Modules">
        <div className="grid gap-3 p-4 sm:grid-cols-2 lg:grid-cols-3 xl:grid-cols-4">
          {modules.map(({ href, label, desc, icon: Icon }) => (
            <Link
              key={href}
              href={href}
              className="group flex items-center gap-3 rounded-2xl border border-slate-100 bg-surface-muted px-4 py-3.5 transition hover:border-brand-200 hover:bg-brand-50"
            >
              <span className="inline-flex h-11 w-11 shrink-0 items-center justify-center rounded-xl bg-white text-brand-600 shadow-soft group-hover:bg-brand-600 group-hover:text-white">
                <Icon size={20} />
              </span>
              <div>
                <p className="font-semibold text-slate-800">{label}</p>
                <p className="text-xs text-slate-500">{desc}</p>
              </div>
            </Link>
          ))}
        </div>
      </Card>
    </div>
  );
}
