"use client";

import { FormEvent, useEffect, useState } from "react";
import { Pencil, Plus, Trash2, FileSpreadsheet, FileText } from "lucide-react";
import { formatDate, formatMoney, downloadCsv, printHtml } from "@/lib/utils";
import {
  Button,
  Card,
  EmptyState,
  Input,
  Modal,
  PageHeader,
  Select,
  TextArea,
} from "@/components/ui";
import { ModuleSearch, matchSearch } from "@/components/ModuleSearch";

type Expense = {
  id: number;
  expense_date: string;
  category: string;
  title: string;
  amount: number;
  paid_from: string;
  salesman_id: number | null;
  notes: string | null;
};

type Salesman = { id: number; name: string };

const empty = {
  expense_date: new Date().toISOString().slice(0, 10),
  category: "General",
  title: "",
  amount: 0,
  paid_from: "Cash",
  salesman_id: 0,
  notes: "",
};

export default function ExpensesPage() {
  const [rows, setRows] = useState<Expense[]>([]);
  const [salesmen, setSalesmen] = useState<Salesman[]>([]);
  const [open, setOpen] = useState(false);
  const [editing, setEditing] = useState<Expense | null>(null);
  const [form, setForm] = useState(empty);
  const [saving, setSaving] = useState(false);
  const [historical, setHistorical] = useState(false);
  const [q, setQ] = useState("");

  async function load() {
    const [e, s] = await Promise.all([
      fetch("/api/expenses").then((r) => r.json()),
      fetch("/api/salesmen").then((r) => r.json()),
    ]);
    setRows(e);
    setSalesmen(s);
  }

  useEffect(() => {
    load();
  }, []);

  useEffect(() => {
    const params = new URLSearchParams(window.location.search);
    const d = params.get("date");
    const hist = params.get("historical") === "1";
    if (!d && !hist) return;
    setHistorical(hist);
    setEditing(null);
    setForm({
      ...empty,
      expense_date: d || empty.expense_date,
      notes: hist ? "Paper / old record" : "",
    });
    setOpen(true);
  }, []);

  function openCreate() {
    setEditing(null);
    setHistorical(false);
    setForm(empty);
    setOpen(true);
  }

  function openEdit(row: Expense) {
    setEditing(row);
    setForm({
      expense_date: row.expense_date,
      category: row.category,
      title: row.title,
      amount: row.amount,
      paid_from: row.paid_from,
      salesman_id: row.salesman_id || 0,
      notes: row.notes || "",
    });
    setOpen(true);
  }

  async function save(e: FormEvent) {
    e.preventDefault();
    setSaving(true);
    try {
      await fetch("/api/expenses", {
        method: editing ? "PUT" : "POST",
        headers: { "Content-Type": "application/json" },
        body: JSON.stringify(
          editing ? { ...form, id: editing.id } : { ...form, historical }
        ),
      });
      setOpen(false);
      await load();
    } finally {
      setSaving(false);
    }
  }

  async function remove(id: number) {
    if (!confirm("Delete this expense?")) return;
    await fetch(`/api/expenses?id=${id}`, { method: "DELETE" });
    await load();
  }

  function printBill(row: Expense) {
    printHtml(
      `Expense ${row.id}`,
      `<h1>Expense Voucher</h1>
       <h2>#${row.id} · ${formatDate(row.expense_date)}</h2>
       <div class="meta">
         <div>Title: <strong>${row.title}</strong><br/>Category: ${row.category}</div>
         <div>Paid From: ${row.paid_from}<br/>Amount: <strong>${formatMoney(row.amount)}</strong></div>
       </div>
       <p>${row.notes || ""}</p>`
    );
  }

  const total = rows.reduce((s, r) => s + r.amount, 0);
  const filtered = rows.filter((r) =>
    matchSearch(`${r.title} ${r.category} ${r.paid_from} ${r.notes || ""}`, q)
  );

  return (
    <div>
      <PageHeader
        title="Expenses"
        subtitle={`Total expenses: ${formatMoney(total)}`}
        action={
          <div className="flex gap-2">
            <Button
              variant="secondary"
              onClick={() =>
                downloadCsv(
                  "expenses.csv",
                  filtered.map((r) => ({
                    Date: r.expense_date,
                    Category: r.category,
                    Title: r.title,
                    Amount: r.amount,
                    "Paid From": r.paid_from,
                    Notes: r.notes,
                  }))
                )
              }
            >
              <FileSpreadsheet size={16} /> Excel
            </Button>
            <Button onClick={openCreate}>
              <Plus size={16} /> Add Expense
            </Button>
          </div>
        }
      />

      <ModuleSearch value={q} onChange={setQ} placeholder="Search by expense title or category..." />

      {filtered.length === 0 ? (
        <EmptyState message={q ? "No expense found for this search." : "No expenses yet."} />
      ) : (
        <Card>
          <div className="overflow-x-auto">
            <table className="w-full min-w-[900px] text-left text-sm">
              <thead>
                <tr className="border-b border-slate-100">
                  {["Date", "Category", "Title", "Amount", "Paid From", "Action"].map((h) => (
                    <th
                      key={h}
                      className="px-5 py-3 text-xs font-semibold uppercase tracking-wide text-slate-400"
                    >
                      {h}
                    </th>
                  ))}
                </tr>
              </thead>
              <tbody>
                {filtered.map((r) => (
                  <tr key={r.id} className="border-b border-slate-50">
                    <td className="px-5 py-3.5 text-slate-600">{formatDate(r.expense_date)}</td>
                    <td className="px-5 py-3.5 text-slate-600">{r.category}</td>
                    <td className="px-5 py-3.5 font-semibold text-slate-800">{r.title}</td>
                    <td className="px-5 py-3.5 font-semibold">{formatMoney(r.amount)}</td>
                    <td className="px-5 py-3.5 text-slate-600">{r.paid_from}</td>
                    <td className="px-5 py-3.5">
                      <div className="flex gap-1">
                        <Button variant="ghost" className="!px-2 !py-1.5" onClick={() => openEdit(r)}>
                          <Pencil size={15} />
                        </Button>
                        <Button
                          variant="ghost"
                          className="!px-2 !py-1.5"
                          onClick={() => printBill(r)}
                        >
                          <FileText size={15} />
                        </Button>
                        <Button
                          variant="ghost"
                          className="!px-2 !py-1.5 text-rose-500"
                          onClick={() => remove(r.id)}
                        >
                          <Trash2 size={15} />
                        </Button>
                      </div>
                    </td>
                  </tr>
                ))}
              </tbody>
            </table>
          </div>
        </Card>
      )}

      <Modal
        open={open}
        onClose={() => setOpen(false)}
        title={editing ? "Edit Expense" : historical ? "Add Paper / Old Expense" : "Add Expense"}
      >
        <form onSubmit={save} className="space-y-3">
          <div className="grid grid-cols-2 gap-3">
            <Input
              label="Date"
              type="date"
              value={form.expense_date}
              onChange={(e) => setForm({ ...form, expense_date: e.target.value })}
            />
            <Input
              label="Category"
              value={form.category}
              onChange={(e) => setForm({ ...form, category: e.target.value })}
            />
          </div>
          <Input
            label="Title"
            required
            value={form.title}
            onChange={(e) => setForm({ ...form, title: e.target.value })}
          />
          <div className="grid grid-cols-2 gap-3">
            <Input
              label="Amount"
              type="number"
              min={0}
              value={form.amount}
              onChange={(e) => setForm({ ...form, amount: Number(e.target.value) })}
            />
            <Input
              label="Paid From"
              value={form.paid_from}
              onChange={(e) => setForm({ ...form, paid_from: e.target.value })}
            />
          </div>
          <Select
            label="Salesman (optional)"
            value={form.salesman_id || ""}
            onChange={(e) => setForm({ ...form, salesman_id: Number(e.target.value) })}
          >
            <option value="">None</option>
            {salesmen.map((s) => (
              <option key={s.id} value={s.id}>
                {s.name}
              </option>
            ))}
          </Select>
          <TextArea
            label="Notes"
            value={form.notes}
            onChange={(e) => setForm({ ...form, notes: e.target.value })}
          />
          <div className="flex justify-end gap-2">
            <Button variant="secondary" type="button" onClick={() => setOpen(false)}>
              Cancel
            </Button>
            <Button type="submit" disabled={saving}>
              {saving ? "Saving..." : "Save"}
            </Button>
          </div>
        </form>
      </Modal>
    </div>
  );
}
