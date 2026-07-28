"use client";

import { useEffect, useState } from "react";
import { formatDate, formatMoney, downloadCsv } from "@/lib/utils";
import { Button, Card, Input, PageHeader } from "@/components/ui";
import { FileSpreadsheet, Plus, X, Trash2 } from "lucide-react";
import { ModuleSearch, matchSearch } from "@/components/ModuleSearch";
import { ledgerSubTabs } from "@/lib/ledger-categories";

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
  { id: "customer", label: "Customer Ledger" },
  { id: "salesman", label: "Salesman Ledger" },
  { id: "floor", label: "Floor Ledger" },
];

const emptyForm = {
  entry_date: new Date().toISOString().split("T")[0],
  ref: "",
  party: "",
  debit: "",
  credit: "",
  source: "",
  notes: "",
};

export default function LedgersPage() {
  const [tab, setTab] = useState("company");
  const [subTab, setSubTab] = useState("company");
  const [rows, setRows] = useState<LedgerRow[]>([]);
  const [from, setFrom] = useState("");
  const [to, setTo] = useState("");
  const [colLabels, setColLabels] = useState({ debit: "Debit", credit: "Credit", notes: "Notes" });
  const [q, setQ] = useState("");
  const [open, setOpen] = useState(false);
  const [editing, setEditing] = useState<LedgerRow | null>(null);
  const [form, setForm] = useState(emptyForm);
  const [saving, setSaving] = useState(false);
  const [error, setError] = useState("");

  async function load(type = tab) {
    const qs = new URLSearchParams({ type, sub_type: subTab });
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
  }, [tab, subTab]);

  function openCreate() {
    setEditing(null);
    setForm({ ...emptyForm, entry_date: new Date().toISOString().split("T")[0] });
    setError("");
    setOpen(true);
  }

  function openEdit(row: LedgerRow) {
    setEditing(row);
    setForm({
      entry_date: row.date,
      ref: row.ref || "",
      party: row.party || "",
      debit: String(row.debit),
      credit: String(row.credit),
      source: row.source || "",
      notes: String(row.notes || ""),
    });
    setError("");
    setOpen(true);
  }

  async function save(e: React.FormEvent) {
    e.preventDefault();
    setSaving(true);
    setError("");
    try {
      const body = {
        ledger_type: tab,
        entry_date: form.entry_date,
        ref: form.ref,
        party: form.party,
        debit: Number(form.debit) || 0,
        credit: Number(form.credit) || 0,
        source: form.source,
        notes: form.notes,
      };
      const method = editing ? "DELETE" : "POST";
      if (editing) {
        await fetch(`/api/ledgers/entries?id=${editing.id}`, { method: "DELETE" });
      }
      const res = await fetch("/api/ledgers/entries", {
        method: "POST",
        headers: { "Content-Type": "application/json" },
        body: JSON.stringify(body),
      });
      const data = await res.json();
      if (!res.ok) throw new Error(data.error || "Failed");
      setOpen(false);
      await load();
    } catch (err) {
      setError(err instanceof Error ? err.message : "Error");
    } finally {
      setSaving(false);
    }
  }

  async function remove(id: number) {
    if (!confirm("Delete this entry?")) return;
    try {
      await fetch(`/api/ledgers/entries?id=${id}`, { method: "DELETE" });
      await load();
    } catch {}
  }

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
          <Button onClick={openCreate}>
            <Plus size={16} /> Add Entry
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
              setSubTab(t.id === "company" ? "company" : t.id === "salesman" ? "salesman" : t.id);
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

      {ledgerSubTabs[tab as keyof typeof ledgerSubTabs] && (
        <div className="mb-4 flex flex-wrap gap-2">
          {ledgerSubTabs[tab as keyof typeof ledgerSubTabs].map((item) => (
            <button
              key={item.id}
              type="button"
              onClick={() => setSubTab(item.id)}
              className={`rounded-full px-3 py-1.5 text-sm font-semibold transition ${
                subTab === item.id ? "bg-brand-600 text-white" : "bg-white text-slate-600 shadow-soft"
              }`}
            >
              {item.label}
            </button>
          ))}
        </div>
      )}

      <ModuleSearch value={q} onChange={setQ} placeholder="Search by name or party..." />

      <div className="mb-4 flex flex-wrap items-end gap-3">
        <Input label="From" type="date" value={from} onChange={(e) => setFrom(e.target.value)} />
        <Input label="To" type="date" value={to} onChange={(e) => setTo(e.target.value)} />
        <Button onClick={() => load()}>Filter</Button>
      </div>

      <div className="mb-4 grid gap-3 sm:grid-cols-3">
        <div className="card px-4 py-3">
          <p className="text-xs text-slate-400">{colLabels.debit}</p>
          <p className="text-lg font-bold text-slate-800">{formatMoney(totalDebit)}</p>
        </div>
        <div className="card px-4 py-3">
          <p className="text-xs text-slate-400">{colLabels.credit}</p>
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
                {["Date", "Ref", "Party", colLabels.debit, colLabels.credit, "Source", colLabels.notes, "Actions"].map(
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
                  <td colSpan={8} className="px-5 py-10 text-center text-slate-500">
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
                    <td className="px-5 py-3">
                      <div className="flex items-center gap-1">
                        <button
                          type="button"
                          onClick={() => openEdit(r)}
                          className="rounded-lg p-1.5 text-slate-500 hover:bg-surface-muted"
                          title="Edit"
                        >
                          <X size={16} />
                        </button>
                        <button
                          type="button"
                          onClick={() => remove(r.id)}
                          className="rounded-lg p-1.5 text-rose-500 hover:bg-rose-50"
                          title="Delete"
                        >
                          <Trash2 size={16} />
                        </button>
                      </div>
                    </td>
                  </tr>
                ))
              )}
            </tbody>
          </table>
        </div>
      </Card>

      <div
        className={`fixed inset-0 z-[60] flex items-start justify-center overflow-y-auto bg-slate-900/40 p-4 pt-10 backdrop-blur-[2px] sm:pt-16 ${
          open ? "" : "hidden"
        }`}
        onClick={(e) => { if (e.target === e.currentTarget) setOpen(false); }}
      >
        <div className="w-full rounded-2xl bg-surface-card shadow-2xl max-w-lg">
          <div className="flex items-center justify-between border-b border-edge px-5 py-4">
            <h2 className="text-lg font-semibold text-ink">{editing ? "Edit Entry" : "Add Entry"}</h2>
            <button
              type="button"
              onClick={() => setOpen(false)}
              className="rounded-lg p-1 text-muted hover:bg-surface-muted hover:text-ink"
              aria-label="Close"
            >
              <X size={18} />
            </button>
          </div>
          <form onSubmit={save} className="px-5 py-4 space-y-3">
            <Input label="Date" type="date" value={form.entry_date} onChange={(e) => setForm({ ...form, entry_date: e.target.value })} required />
            <Input label="Ref / Invoice No." value={form.ref} onChange={(e) => setForm({ ...form, ref: e.target.value })} />
            <Input label="Party / Name" value={form.party} onChange={(e) => setForm({ ...form, party: e.target.value })} />
            <div className="grid grid-cols-2 gap-3">
              <Input label={`Debit (${colLabels.debit})`} type="number" step="0.01" value={form.debit} onChange={(e) => setForm({ ...form, debit: e.target.value })} />
              <Input label={`Credit (${colLabels.credit})`} type="number" step="0.01" value={form.credit} onChange={(e) => setForm({ ...form, credit: e.target.value })} />
            </div>
            <Input label="Source" value={form.source} onChange={(e) => setForm({ ...form, source: e.target.value })} />
            <div className="space-y-1.5">
              <span className="text-xs font-semibold text-muted">Notes</span>
              <textarea
                className="w-full rounded-xl border border-edge bg-surface-card px-3.5 py-2.5 text-sm text-ink outline-none ring-brand-400 placeholder:text-muted focus:border-brand-400 focus:ring-2"
                rows={2}
                value={form.notes}
                onChange={(e) => setForm({ ...form, notes: e.target.value })}
              />
            </div>
            {error && <p className="text-sm text-rose-500">{error}</p>}
            <div className="flex justify-end gap-2">
              <Button variant="secondary" type="button" onClick={() => setOpen(false)}>
                Cancel
              </Button>
              <Button type="submit" disabled={saving}>
                {saving ? "Saving..." : editing ? "Update" : "Save"}
              </Button>
            </div>
          </form>
        </div>
      </div>
    </div>
  );
}
