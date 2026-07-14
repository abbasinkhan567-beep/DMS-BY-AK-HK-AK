"use client";

import { useEffect, useState } from "react";
import {
  TrendingUp,
  TrendingDown,
  CalendarDays,
  CalendarRange,
  Calendar,
} from "lucide-react";
import { formatDate, formatMoney } from "@/lib/utils";
import { PageHeader } from "@/components/ui";

type Period = {
  income: number;
  received: number;
  pending: number;
  expense: number;
  purchase: number;
  net_income: number;
  bills: number;
  expense_count: number;
  commission: number;
  discount: number;
  bill_expense: number;
  purchase_expense: number;
  manual_expense: number;
};

type IncomeData = {
  today: string;
  month: string;
  year: number;
  daily: Period;
  monthly: Period;
  yearly: Period;
};

function PeriodCard({
  title,
  subtitle,
  icon: Icon,
  data,
}: {
  title: string;
  subtitle: string;
  icon: React.ComponentType<{ size?: number }>;
  data: Period;
}) {
  const positive = data.net_income >= 0;
  return (
    <div className="card overflow-hidden">
      <div className="flex items-center gap-3 border-b border-slate-100 px-5 py-4">
        <span className="inline-flex h-10 w-10 items-center justify-center rounded-xl bg-brand-50 text-brand-600">
          <Icon size={20} />
        </span>
        <div>
          <h2 className="font-semibold text-slate-800">{title}</h2>
          <p className="text-xs text-slate-500">{subtitle}</p>
        </div>
      </div>

      <div className="space-y-3 p-5">
        <div className="flex items-center justify-between text-sm">
          <span className="text-slate-500">Sales</span>
          <span className="font-semibold text-emerald-600">{formatMoney(data.income)}</span>
        </div>
        <div className="space-y-1.5 rounded-xl bg-rose-50/60 p-3 text-xs text-slate-600">
          <div className="flex justify-between">
            <span>Expenses</span>
            <span>{formatMoney(data.manual_expense)}</span>
          </div>
          <div className="flex justify-between">
            <span>Discounts</span>
            <span>{formatMoney(data.discount)}</span>
          </div>
          <div className="flex justify-between">
            <span>Bill expenses</span>
            <span>{formatMoney(data.bill_expense)}</span>
          </div>
          <div className="flex justify-between">
            <span>Purchase expenses</span>
            <span>{formatMoney(data.purchase_expense)}</span>
          </div>
          <div className="flex justify-between">
            <span>Commission</span>
            <span>{formatMoney(data.commission)}</span>
          </div>
          <div className="flex justify-between border-t border-rose-100 pt-1.5 font-semibold text-rose-600">
            <span>Total</span>
            <span>{formatMoney(data.expense)}</span>
          </div>
        </div>
        <div className="h-px bg-slate-100" />
        <div className="flex items-center justify-between">
          <span className="flex items-center gap-1.5 text-sm font-semibold text-slate-700">
            {positive ? (
              <TrendingUp size={16} className="text-emerald-600" />
            ) : (
              <TrendingDown size={16} className="text-rose-500" />
            )}
            Net Income
          </span>
          <span className={`text-xl font-bold ${positive ? "text-emerald-600" : "text-rose-500"}`}>
            {formatMoney(data.net_income)}
          </span>
        </div>
      </div>
    </div>
  );
}

export default function IncomePage() {
  const [data, setData] = useState<IncomeData | null>(null);

  useEffect(() => {
    fetch("/api/income")
      .then((r) => r.json())
      .then(setData)
      .catch(console.error);
  }, []);

  if (!data) {
    return (
      <div className="flex h-64 items-center justify-center text-sm text-slate-500">
        Loading income...
      </div>
    );
  }

  return (
    <div>
      <PageHeader title="Income" subtitle="Performance summary" />

      <div className="mb-5 grid gap-4 sm:grid-cols-3">
        {[
          { label: "Today", value: data.daily.net_income },
          { label: "This Month", value: data.monthly.net_income },
          { label: "This Year", value: data.yearly.net_income },
        ].map((s) => (
          <div key={s.label} className="card px-5 py-4">
            <p className="text-xs font-semibold uppercase tracking-wide text-slate-400">{s.label}</p>
            <p
              className={`mt-2 text-2xl font-bold ${
                s.value >= 0 ? "text-emerald-600" : "text-rose-500"
              }`}
            >
              {formatMoney(s.value)}
            </p>
          </div>
        ))}
      </div>

      <div className="grid gap-5 lg:grid-cols-3">
        <PeriodCard title="Daily" subtitle={formatDate(data.today)} icon={CalendarDays} data={data.daily} />
        <PeriodCard title="Monthly" subtitle={data.month} icon={CalendarRange} data={data.monthly} />
        <PeriodCard title="Yearly" subtitle={String(data.year)} icon={Calendar} data={data.yearly} />
      </div>
    </div>
  );
}
