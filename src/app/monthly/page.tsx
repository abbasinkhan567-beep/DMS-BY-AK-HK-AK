"use client";

import { useCallback, useEffect, useState } from "react";
import { ChevronDown, ChevronRight, FileSpreadsheet, Printer } from "lucide-react";
import { Button, Card, PageHeader } from "@/components/ui";
import { downloadCsv, formatMoney, printHtml } from "@/lib/utils";

type LedgerRow = {
  id: number;
  date: string;
  ref: string | null;
  party: string;
  debit: number;
  credit: number;
  source: string;
  notes: string | null;
};

type Account = {
  name: string;
  opening: number;
  debit: number;
  credit: number;
  closing: number;
  rows: LedgerRow[];
};

type MonthlyData = {
  month: string;
  type: string;
  subType: string;
  single: boolean;
  accounts: Account[];
  totals: { opening: number; debit: number; credit: number; closing: number };
};

const tabs = [
  { key: "customer", label: "Customers" },
  { key: "salesman", label: "Salesmen" },
  { key: "company", label: "Company" },
  { key: "expense", label: "Expenses" },
  { key: "product", label: "Products" },
  { key: "floor", label: "Floor Stock" },
];

const salesmanSubs = [
  { key: "salesman", label: "Commission" },
  { key: "salesman-to-customer", label: "Salesman -> Customer" },
  { key: "customer-to-salesman", label: "Customer -> Salesman" },
];

const companySubs = [
  { key: "company", label: "All Purchases" },
  { key: "company-conditional", label: "Conditional" },
  { key: "company-hand", label: "Hand to Hand" },
  { key: "company-paid", label: "Paid" },
];

export default function MonthlyPage() {
  const now = new Date();
  const [month, setMonth] = useState(
    `${now.getFullYear()}-${String(now.getMonth() + 1).padStart(2, "0")}`
  );
  const [type, setType] = useState("customer");
  const [subType, setSubType] = useState("customer");
  const [data, setData] = useState<MonthlyData | null>(null);
  const [loading, setLoading] = useState(false);
  const [expanded, setExpanded] = useState<Record<number, boolean>>({});

  const load = useCallback(async () => {
    setLoading(true);
    try {
      const res = await fetch(
        `/api/monthly?month=${month}&type=${type}&sub_type=${subType}`
      );
      const json = await res.json();
      if (json.error) throw new Error(json.error);
      setData(json);
    } catch {
      setData(null);
    } finally {
      setLoading(false);
    }
  }, [month, type, subType]);

  useEffect(() => {
    load();
  }, [load]);

  const subsList =
    type === "salesman" ? salesmanSubs : type === "company" ? companySubs : [];
  const t = data?.totals;

  function doPrint() {
    if (!data) return;
    const rowsHtml = data.accounts
      .map((a) => {
        const daily = a.rows
          .map(
            (r) => `<tr>
        <td>${r.date || "-"}</td>
        <td>${r.ref || "-"}</td>
        <td>${r.source || "-"}</td>
        <td>${formatMoney(r.debit)}</td>
        <td>${formatMoney(r.credit)}</td>
      </tr>`
          )
          .join("");
        return `<h3>${a.name}</h3>
      <table>
        <thead><tr><th>Date</th><th>Ref</th><th>Source</th><th>Debit</th><th>Credit</th></tr></thead>
        <tbody>${daily}</tbody>
        <tfoot><tr><th colspan="3">Opening: ${formatMoney(a.opening)}</th>
        <th>${formatMoney(a.debit)}</th><th>${formatMoney(a.credit)}</th></tr>
        <tr><th colspan="3">Closing Balance</th><th colspan="2">${formatMoney(a.closing)}</th></tr></tfoot>
      </table>`;
      })
      .join("");
    printHtml(
      `Monthly Report ${data.month}`,
      `<h1>Pepsi Distribution</h1>
       <h2>Monthly Report - ${data.month}</h2>
       <h3>Total: Opening ${formatMoney(t!.opening)} | In ${formatMoney(t!.debit)} | Out ${formatMoney(t!.credit)} | Closing ${formatMoney(t!.closing)}</h3>
       ${rowsHtml}`
    );
  }

  function doExcel() {
    if (!data) return;
    const rows: Record<string, string | number>[] = [
      { Month: data.month, Account: "", Opening: "", In: "", Out: "", Closing: "" },
    ];
    for (const a of data.accounts) {
      rows.push({
        Month: data.month,
        Account: a.name,
        Opening: a.opening,
        In: a.debit,
        Out: a.credit,
        Closing: a.closing,
      });
      for (const r of a.rows) {
        rows.push({
          Month: data.month,
          Account: `${a.name} - Daily`,
          Opening: "",
          In: r.debit,
          Out: r.credit,
          Closing: `${r.date} ${r.ref || ""} ${r.source || ""}`,
        });
      }
    }
    downloadCsv(`monthly-${data.month}.csv`, rows);
  }

  return (
    <div>
      <PageHeader
        title="Monthly Report"
        subtitle="Complete month-wise account of every ledger"
        action={
          <div className="flex gap-2">
            <Button variant="secondary" onClick={doExcel}>
              <FileSpreadsheet size={16} /> Excel
            </Button>
            <Button onClick={doPrint}>
              <Printer size={16} /> Print
            </Button>
          </div>
        }
      />

      <div className="mb-4 flex flex-wrap items-end gap-3">
        <div>
          <label className="mb-1 block text-xs font-semibold uppercase tracking-wide text-muted">
            Month
          </label>
          <input
            type="month"
            value={month}
            onChange={(e) => setMonth(e.target.value || month)}
            className="rounded-xl border border-edge bg-surface-card px-3 py-2 text-sm text-ink outline-none focus:border-brand-400 focus:ring-2"
          />
        </div>
        {subsList.length > 0 && (
          <div>
            <label className="mb-1 block text-xs font-semibold uppercase tracking-wide text-muted">
              View
            </label>
            <select
              value={subType}
              onChange={(e) => setSubType(e.target.value)}
              className="min-w-[180px] rounded-xl border border-edge bg-surface-card px-3 py-2 text-sm text-ink outline-none focus:border-brand-400 focus:ring-2"
            >
              {subsList.map((s) => (
                <option key={s.key} value={s.key}>
                  {s.label}
                </option>
              ))}
            </select>
          </div>
        )}
      </div>

      <div className="mb-4 flex flex-wrap gap-2">
        {tabs.map((tab) => (
          <button
            key={tab.key}
            type="button"
            onClick={() => {
              setType(tab.key);
              setSubType(tab.key);
            }}
            className={`rounded-full px-4 py-1.5 text-sm font-semibold ${
              type === tab.key
                ? "bg-brand-600 text-white"
                : "bg-surface-card text-muted shadow-soft hover:text-ink"
            }`}
          >
            {tab.label}
          </button>
        ))}
      </div>

      <div className="mb-4 grid grid-cols-2 gap-3 sm:grid-cols-4">
        <Stat label="Opening Balance" value={t?.opening ?? 0} />
        <Stat label="In / Debit" value={t?.debit ?? 0} tone="green" />
        <Stat label="Out / Credit" value={t?.credit ?? 0} tone="red" />
        <Stat label="Closing Balance" value={t?.closing ?? 0} strong />
      </div>

      {loading ? (
        <p className="text-sm text-muted">Loading...</p>
      ) : !data || data.accounts.length === 0 ? (
        <p className="text-sm text-muted">No records for this month.</p>
      ) : (
        <div className="space-y-3">
          {data.accounts.map((a, idx) => {
            const open = expanded[idx];
            return (
              <Card key={a.name}>
                <button
                  type="button"
                  className="flex w-full items-center justify-between px-5 py-3 text-left"
                  onClick={() => setExpanded((e) => ({ ...e, [idx]: !e[idx] }))}
                >
                  <span className="flex items-center gap-2 font-semibold text-ink">
                    {open ? <ChevronDown size={16} /> : <ChevronRight size={16} />}
                    {a.name}
                  </span>
                  <span className="flex items-center gap-4 text-sm">
                    <span className="text-muted">
                      Open <b className="text-ink">{formatMoney(a.opening)}</b>
                    </span>
                    <span className="text-emerald-600">
                      In <b>{formatMoney(a.debit)}</b>
                    </span>
                    <span className="text-rose-500">
                      Out <b>{formatMoney(a.credit)}</b>
                    </span>
                    <span className="text-brand-700">
                      Closing <b>{formatMoney(a.closing)}</b>
                    </span>
                  </span>
                </button>
                {open && (
                  <div className="overflow-x-auto border-t border-edge">
                    <table className="w-full min-w-[720px] text-left text-sm">
                      <thead>
                        <tr className="border-b border-slate-100">
                          <th className="px-4 py-2.5 text-xs font-semibold uppercase tracking-wide text-muted">Date</th>
                          <th className="px-4 py-2.5 text-xs font-semibold uppercase tracking-wide text-muted">Ref</th>
                          <th className="px-4 py-2.5 text-xs font-semibold uppercase tracking-wide text-muted">Source</th>
                          <th className="px-4 py-2.5 text-right text-xs font-semibold uppercase tracking-wide text-muted">Debit</th>
                          <th className="px-4 py-2.5 text-right text-xs font-semibold uppercase tracking-wide text-muted">Credit</th>
                        </tr>
                      </thead>
                      <tbody>
                        {a.rows.length === 0 && (
                          <tr>
                            <td colSpan={5} className="px-4 py-3 text-muted">
                              No daily entries this month.
                            </td>
                          </tr>
                        )}
                        {a.rows.map((r, i) => (
                          <tr key={i} className="border-b border-slate-50">
                            <td className="px-4 py-2.5 text-slate-600">{r.date}</td>
                            <td className="px-4 py-2.5 text-slate-600">{r.ref || "-"}</td>
                            <td className="px-4 py-2.5 text-slate-600">
                              {r.source || "-"}
                              {r.notes ? <span className="ml-1 text-xs text-muted">· {r.notes}</span> : null}
                            </td>
                            <td className="px-4 py-2.5 text-right font-medium text-emerald-600">
                              {formatMoney(r.debit)}
                            </td>
                            <td className="px-4 py-2.5 text-right font-medium text-rose-500">
                              {formatMoney(r.credit)}
                            </td>
                          </tr>
                        ))}
                      </tbody>
                    </table>
                  </div>
                )}
              </Card>
            );
          })}
        </div>
      )}
    </div>
  );
}

function Stat({
  label,
  value,
  tone,
  strong,
}: {
  label: string;
  value: number;
  tone?: "green" | "red";
  strong?: boolean;
}) {
  const color =
    tone === "green"
      ? "text-emerald-600"
      : tone === "red"
        ? "text-rose-500"
        : strong
          ? "text-brand-700"
          : "text-ink";
  return (
    <Card className="px-4 py-3">
      <p className="text-xs font-semibold uppercase tracking-wide text-muted">{label}</p>
      <p className={`mt-1 text-lg font-bold ${color}`}>{formatMoney(value)}</p>
    </Card>
  );
}