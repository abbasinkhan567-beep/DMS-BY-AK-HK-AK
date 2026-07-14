"use client";

import { useEffect, useState } from "react";
import { formatDate, formatMoney, downloadCsv } from "@/lib/utils";
import { Button, Card, Input, PageHeader } from "@/components/ui";
import { FileSpreadsheet } from "lucide-react";
import { ModuleSearch, matchSearch } from "@/components/ModuleSearch";

type LedgerRow = {
  id: number;
  date: string;
  ref: string | null;
  party: string | null;
  debit: number;
  credit: number;
  source: string | null;
  notes: string | number | null;
};

const tabs = [
  { id: "company", label: "Company Ledger" },
  { id: "expense", label: "Expense Ledger" },
  { id: "salesman", label: "Salesman Ledger" },
  { id: "floor", label: "Floor Ledger" },
];

export default function LedgersPage() {
  const [tab, setTab] = useState("company");
  const [rows, setRows] = useState<LedgerRow[]>([]);
  const [from, setFrom] = useState("");
  const [to, setTo] = useState("");
  const [colLabels, setColLabels] = useState({ debit: "Debit", credit: "Credit", notes: "Notes" });
  const [q, setQ] = useState("");

  async function load(type = tab) {
    const qs = new URLSearchParams({ type });
    if (from) qs.set("from", from);
    if (to) qs.set("to", to);
    const res = await fetch(`/api/ledgers?${qs}`);
    const data = await res.json();
    setRows(data.rows || []);
    if (data.columns) {
      setColLabels({
        debit: data.columns.debit || "Debit",
        credit: data.columns.credit || "Credit",
        notes: data.columns.notes || "Notes",
      });
    } else {
      setColLabels({ debit: "Debit", credit: "Credit", notes: "Notes" });
    }
  }

  useEffect(() => {
    load(tab);
    // eslint-disable-next-line react-hooks/exhaustive-deps
  }, [tab]);

  const totalDebit = rows.reduce((s, r) => s + (Number(r.debit) || 0), 0);
  const totalCredit = rows.reduce((s, r) => s + (Number(r.credit) || 0), 0);
  const filtered = rows.filter((r) =>
    matchSearch(`${r.party || ""} ${r.ref || ""} ${r.source || ""} ${r.notes ?? ""}`, q)
  );

  return (
    <div>
      <PageHeader
        title="Ledgers"
        subtitle="Ledgers"
        action={
          <Button
            variant="secondary"
            onClick={() =>
              downloadCsv(
                `${tab}-ledger.csv`,
                filtered.map((r) => ({
                  Date: r.date,
                  Ref: r.ref,
                  Party: r.party,
                  Debit: r.debit,
                  Credit: r.credit,
                  Source: r.source,
                  Notes: r.notes,
                }))
              )
            }
          >
            <FileSpreadsheet size={16} /> Excel
          </Button>
        }
      />

      <div className="mb-4 flex flex-wrap gap-2">
        {tabs.map((t) => (
          <button
            key={t.id}
            type="button"
            onClick={() => {
              setTab(t.id);
              setQ("");
            }}
            className={`rounded-xl px-4 py-2.5 text-sm font-semibold transition ${
              tab === t.id ? "bg-brand-600 text-white" : "bg-white text-slate-600 shadow-soft"
            }`}
          >
            {t.label}
          </button>
        ))}
      </div>

      <ModuleSearch
        value={q}
        onChange={setQ}
        placeholder="Search by name or party..."
      />

      <div className="mb-4 flex flex-wrap items-end gap-3">
        <Input label="From" type="date" value={from} onChange={(e) => setFrom(e.target.value)} />
        <Input label="To" type="date" value={to} onChange={(e) => setTo(e.target.value)} />
        <Button onClick={() => load()}>Filter</Button>
      </div>

      <div className="mb-4 grid gap-3 sm:grid-cols-3">
        <div className="card px-4 py-3">
          <p className="text-xs text-slate-400">Debit</p>
          <p className="text-lg font-bold text-slate-800">{formatMoney(totalDebit)}</p>
        </div>
        <div className="card px-4 py-3">
          <p className="text-xs text-slate-400">Credit</p>
          <p className="text-lg font-bold text-slate-800">{formatMoney(totalCredit)}</p>
        </div>
        <div className="card px-4 py-3">
          <p className="text-xs text-slate-400">Balance</p>
          <p className="text-lg font-bold text-brand-700">{formatMoney(totalDebit - totalCredit)}</p>
        </div>
      </div>

      <Card>
        <div className="overflow-x-auto">
          <table className="w-full min-w-[800px] text-left text-sm">
            <thead>
              <tr className="border-b border-slate-100">
                {["Date", "Ref", "Party", colLabels.debit, colLabels.credit, "Source", colLabels.notes].map(
                  (h) => (
                    <th
                      key={h}
                      className="px-5 py-3 text-xs font-semibold uppercase tracking-wide text-slate-400"
                    >
                      {h}
                    </th>
                  )
                )}
              </tr>
            </thead>
            <tbody>
              {filtered.length === 0 ? (
                <tr>
                  <td colSpan={7} className="px-5 py-10 text-center text-slate-500">
                    {q ? "No data found for this name." : "No entries in this ledger yet."}
                  </td>
                </tr>
              ) : (
                filtered.map((r, i) => (
                  <tr key={`${r.id}-${i}`} className="border-b border-slate-50">
                    <td className="px-5 py-3 text-slate-600">{formatDate(r.date)}</td>
                    <td className="px-5 py-3 text-slate-600">{r.ref || "-"}</td>
                    <td className="px-5 py-3 font-medium text-slate-800">{r.party || "-"}</td>
                    <td className="px-5 py-3">{formatMoney(Number(r.debit) || 0)}</td>
                    <td className="px-5 py-3">{formatMoney(Number(r.credit) || 0)}</td>
                    <td className="px-5 py-3 text-slate-600">{r.source || "-"}</td>
                    <td className="px-5 py-3 text-slate-500">{r.notes ?? "-"}</td>
                  </tr>
                ))
              )}
            </tbody>
          </table>
        </div>
      </Card>
    </div>
  );
}
