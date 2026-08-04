"use client";

import { useCallback, useEffect, useState } from "react";
import Link from "next/link";
import {
  CalendarDays,
  CheckCircle2,
  FileText,
  Pencil,
  Plus,
  ShoppingCart,
  Trash2,
  Truck,
  Wallet,
} from "lucide-react";
import { formatDate, formatMoney, printHtml, todayLocal, escapeHtml } from "@/lib/utils";
import { fetchCompany } from "@/lib/bills";
import { Button, Card, Input, Modal, PageHeader, Select, TextArea } from "@/components/ui";

type DaySummary = {
  sales_count: number;
  purchase_count: number;
  expense_count: number;
  sales_total: number;
  purchase_total: number;
  expense_total: number;
};

type DayDetail = {
  date: string;
  paper: { status: string; notes: string | null } | null;
  summary: DaySummary;
  sales: Array<{ id: number; invoice_no: string | null; sale_date: string; customer_name: string; total_amount: number; paid_amount: number; is_historical?: number }>;
  purchases: Array<{ id: number; invoice_no: string | null; purchase_date: string; supplier: string; total_amount: number; paid_amount: number; is_historical?: number }>;
  expenses: Array<{ id: number; title: string; amount: number; category: string; expense_date: string; paid_from?: string | null; salesman_id?: number | null; notes?: string | null; is_historical?: number }>;
};

type RecentRow = {
  entry_date: string;
  sales_count: number;
  purchase_count: number;
  expense_count: number;
};

export default function PaperEntryPage() {
  const [date, setDate] = useState(() => todayLocal());
  const [detail, setDetail] = useState<DayDetail | null>(null);
  const [recent, setRecent] = useState<RecentRow[]>([]);
  const [notes, setNotes] = useState("");
  const [msg, setMsg] = useState("");
  const [err, setErr] = useState("");
  const [saving, setSaving] = useState(false);

  const [editOpen, setEditOpen] = useState(false);
  const [editForm, setEditForm] = useState({
    title: "",
    amount: 0,
    category: "General",
    notes: "",
    expense_date: "",
    paid_from: "Cash",
    salesman_id: null as number | null,
  });
  const [editId, setEditId] = useState<number | null>(null);

  const loadDay = useCallback(async (d: string) => {
    setErr("");
    try {
      const res = await fetch(`/api/paper-days?date=${encodeURIComponent(d)}`);
      const data = await res.json();
      setDetail(data);
      setNotes(data.paper?.notes || "");
    } catch (e) {
      setErr(e instanceof Error ? e.message : "Failed to load day");
    }
  }, []);

  const loadRecent = useCallback(async () => {
    try {
      const res = await fetch("/api/paper-days");
      const data = await res.json();
      setRecent(data.recentDates || []);
    } catch {
      /* ignore */
    }
  }, []);

  useEffect(() => {
    loadDay(date);
    loadRecent();
  }, [date, loadDay, loadRecent]);

  async function markStatus(status: "in_progress" | "done") {
    setSaving(true);
    setMsg("");
    setErr("");
    try {
      const res = await fetch("/api/paper-days", {
        method: "POST",
        headers: { "Content-Type": "application/json" },
        body: JSON.stringify({ entry_date: date, notes, status }),
      });
      const data = await res.json();
      if (!res.ok) throw new Error(data.error || "Failed");
      setMsg(status === "done" ? "Day marked as paper entry complete." : "Day notes saved.");
      await loadDay(date);
      await loadRecent();
    } catch (e) {
      setErr(e instanceof Error ? e.message : "Error");
    } finally {
      setSaving(false);
    }
  }

  async function deleteEntry(type: "sales" | "purchases" | "expenses", id: number) {
    if (!confirm(`Delete this ${type.slice(0, -1)} record?`)) return;
    try {
      const res = await fetch(`/api/${type}?id=${id}`, { method: "DELETE" });
      if (!res.ok) throw new Error("Delete failed");
      setMsg(`${type.slice(0, -1)} deleted.`);
      await loadDay(date);
      await loadRecent();
    } catch (e) {
      setErr(e instanceof Error ? e.message : "Delete error");
    }
  }

  async function printEntry(type: string, entry: Record<string, unknown>) {
    const company = await fetchCompany();
    const header = `<h1>${escapeHtml(company.name || "Pepsi Distribution")}</h1>
     <h2>${escapeHtml(company.phone || "")} ${company.address ? "· " + escapeHtml(company.address) : ""}</h2>`;
    const dateStr = formatDate(String(entry.expense_date || entry.sale_date || entry.purchase_date || date));
    if (type === "expenses") {
      printHtml(
        `Expense ${entry.id}`,
        `${header}
         <strong>Expense Voucher</strong>
         <h2>#${entry.id} · ${dateStr}</h2>
         <div class="meta">
           <div>Title: <strong>${escapeHtml(entry.title)}</strong><br/>Category: ${escapeHtml(entry.category || "-")}</div>
           <div>Amount: <strong>${formatMoney(Number(entry.amount))}</strong></div>
         </div>`
      );
    } else if (type === "sales") {
      printHtml(
        `Sale ${entry.id}`,
        `${header}
         <strong>Sale Invoice</strong>
         <h2>#${entry.id} · ${dateStr}</h2>
         <div class="meta">
           <div>Customer: <strong>${escapeHtml(entry.customer_name)}</strong><br/>Invoice: ${escapeHtml(entry.invoice_no || "-")}</div>
           <div>Total: <strong>${formatMoney(Number(entry.total_amount))}</strong><br/>Paid: ${formatMoney(Number(entry.paid_amount))}</div>
         </div>`
      );
    } else {
      printHtml(
        `Purchase ${entry.id}`,
        `${header}
         <strong>Purchase Voucher</strong>
         <h2>#${entry.id} · ${dateStr}</h2>
         <div class="meta">
           <div>Supplier: <strong>${escapeHtml(entry.supplier)}</strong><br/>Invoice: ${escapeHtml(entry.invoice_no || "-")}</div>
           <div>Total: <strong>${formatMoney(Number(entry.total_amount))}</strong><br/>Paid: ${formatMoney(Number(entry.paid_amount))}</div>
         </div>`
      );
    }
  }

  function openEditExpense(exp: DayDetail["expenses"][number]) {
    setEditId(exp.id);
    setEditForm({
      title: exp.title,
      amount: exp.amount,
      category: exp.category || "General",
      notes: exp.notes || "",
      expense_date: exp.expense_date,
      paid_from: exp.paid_from || "Cash",
      salesman_id: exp.salesman_id ?? null,
    });
    setEditOpen(true);
  }

  async function saveExpenseEdit() {
    if (!editId) return;
    setSaving(true);
    try {
      const res = await fetch("/api/expenses", {
        method: "PUT",
        headers: { "Content-Type": "application/json" },
        body: JSON.stringify({
          id: editId,
          title: editForm.title,
          amount: editForm.amount,
          category: editForm.category,
          notes: editForm.notes,
          expense_date: editForm.expense_date,
          paid_from: editForm.paid_from,
          salesman_id: editForm.salesman_id,
        }),
      });
      if (!res.ok) throw new Error("Save failed");
      setEditOpen(false);
      setEditId(null);
      setMsg("Expense updated.");
      await loadDay(date);
      await loadRecent();
    } catch (e) {
      setErr(e instanceof Error ? e.message : "Save error");
    } finally {
      setSaving(false);
    }
  }

  const q = `date=${encodeURIComponent(date)}&historical=1`;
  const summary = detail?.summary;

  return (
    <div>
      <PageHeader
        title="Paper / Old Records"
        subtitle="Historical entries"
      />

      <Card title="Pick paper date">
        <div className="space-y-4 p-5">
          <div className="flex flex-wrap items-end gap-3">
            <div className="w-full max-w-xs">
              <Input
                label="Paper form date"
                type="date"
                value={date}
                onChange={(e) => setDate(e.target.value)}
              />
            </div>
            <Button variant="secondary" onClick={() => loadDay(date)}>
              <CalendarDays size={16} /> Load Day
            </Button>
          </div>
          {(msg || err) && (
            <p className={`text-sm ${err ? "text-rose-500" : "text-emerald-600"}`}>{err || msg}</p>
          )}
        </div>
      </Card>

      {summary && (
        <div className="mt-4 grid gap-4 sm:grid-cols-3">
          <div className="card px-5 py-4">
            <p className="text-xs font-semibold uppercase tracking-wide text-muted">Sales</p>
            <p className="mt-1 text-2xl font-bold text-ink">{summary.sales_count}</p>
            <p className="text-sm text-emerald-600">{formatMoney(summary.sales_total)}</p>
          </div>
          <div className="card px-5 py-4">
            <p className="text-xs font-semibold uppercase tracking-wide text-muted">Purchases</p>
            <p className="mt-1 text-2xl font-bold text-ink">{summary.purchase_count}</p>
            <p className="text-sm text-brand-600">{formatMoney(summary.purchase_total)}</p>
          </div>
          <div className="card px-5 py-4">
            <p className="text-xs font-semibold uppercase tracking-wide text-muted">Expenses</p>
            <p className="mt-1 text-2xl font-bold text-ink">{summary.expense_count}</p>
            <p className="text-sm text-rose-500">{formatMoney(summary.expense_total)}</p>
          </div>
        </div>
      )}

      <div className="mt-4 grid gap-4 lg:grid-cols-3">
        <Card title={`Add for ${formatDate(date)}`}>
          <div className="space-y-2 p-5">
            <Link href={`/purchases?${q}`}>
              <Button className="w-full justify-start" variant="secondary">
                <Truck size={16} /> Add Purchase
              </Button>
            </Link>
            <Link href={`/sales?${q}`}>
              <Button className="w-full justify-start" variant="secondary">
                <ShoppingCart size={16} /> Add Sale
              </Button>
            </Link>
            <Link href={`/expenses?${q}`}>
              <Button className="w-full justify-start" variant="secondary">
                <Wallet size={16} /> Add Expense
              </Button>
            </Link>
          </div>
        </Card>

        <Card title="Day checklist">
          <div className="space-y-3 p-5">
            <TextArea
              label="Notes (optional)"
              value={notes}
              onChange={(e) => setNotes(e.target.value)}
              placeholder="e.g. Shop register page 12, salesman Ali route"
            />
            <div className="flex flex-wrap gap-2">
              <Button onClick={() => markStatus("in_progress")} disabled={saving} variant="secondary">
                <FileText size={16} /> Save Notes
              </Button>
              <Button onClick={() => markStatus("done")} disabled={saving}>
                <CheckCircle2 size={16} /> Mark Day Done
              </Button>
            </div>
            {detail?.paper?.status === "done" && (
              <p className="text-sm font-medium text-emerald-600">This paper day is marked done.</p>
            )}
          </div>
        </Card>

        <Card title="Entered on this date">
          <div className="max-h-80 space-y-2 overflow-y-auto p-3 text-sm">
            {!detail ||
            (detail.sales.length === 0 &&
              detail.purchases.length === 0 &&
              detail.expenses.length === 0) ? (
              <p className="p-3 text-muted">Nothing entered for this date yet.</p>
            ) : (
              <>
                {detail.sales.map((s) => (
                  <div key={`s-${s.id}`} className="rounded-xl border border-edge p-3">
                    <div className="flex items-center justify-between gap-2">
                      <div className="min-w-0 flex-1">
                        <p className="font-semibold text-ink truncate">Sale · {s.customer_name}</p>
                        <p className="text-xs text-muted">#{s.id} · {formatMoney(s.total_amount)}</p>
                      </div>
                      <div className="flex shrink-0 gap-1">
                        <Link href={`/sales?id=${s.id}&date=${encodeURIComponent(s.sale_date)}&historical=1`}>
                          <Button variant="ghost" className="!px-2 !py-1" title="Edit">
                            <Pencil size={14} />
                          </Button>
                        </Link>
                        <Button variant="ghost" className="!px-2 !py-1" onClick={() => printEntry("sales", s)} title="Print">
                          <FileText size={14} />
                        </Button>
                        <Button variant="ghost" className="!px-2 !py-1 text-rose-500" onClick={() => deleteEntry("sales", s.id)} title="Delete">
                          <Trash2 size={14} />
                        </Button>
                      </div>
                    </div>
                  </div>
                ))}
                {detail.purchases.map((p) => (
                  <div key={`p-${p.id}`} className="rounded-xl border border-edge p-3">
                    <div className="flex items-center justify-between gap-2">
                      <div className="min-w-0 flex-1">
                        <p className="font-semibold text-ink truncate">Purchase · {p.supplier}</p>
                        <p className="text-xs text-muted">#{p.id} · {formatMoney(p.total_amount)}</p>
                      </div>
                      <div className="flex shrink-0 gap-1">
                        <Link href={`/purchases?id=${p.id}&date=${encodeURIComponent(p.purchase_date)}&historical=1`}>
                          <Button variant="ghost" className="!px-2 !py-1" title="Edit">
                            <Pencil size={14} />
                          </Button>
                        </Link>
                        <Button variant="ghost" className="!px-2 !py-1" onClick={() => printEntry("purchases", p)} title="Print">
                          <FileText size={14} />
                        </Button>
                        <Button variant="ghost" className="!px-2 !py-1 text-rose-500" onClick={() => deleteEntry("purchases", p.id)} title="Delete">
                          <Trash2 size={14} />
                        </Button>
                      </div>
                    </div>
                  </div>
                ))}
                {detail.expenses.map((e) => (
                  <div key={`e-${e.id}`} className="rounded-xl border border-edge p-3">
                    <div className="flex items-center justify-between gap-2">
                      <div className="min-w-0 flex-1">
                        <p className="font-semibold text-ink truncate">Expense · {e.title}</p>
                        <p className="text-xs text-muted">#{e.id} · {formatMoney(e.amount)}</p>
                      </div>
                      <div className="flex shrink-0 gap-1">
                        <Button variant="ghost" className="!px-2 !py-1" onClick={() => openEditExpense(e)} title="Edit">
                          <Pencil size={14} />
                        </Button>
                        <Button variant="ghost" className="!px-2 !py-1" onClick={() => printEntry("expenses", e)} title="Print">
                          <FileText size={14} />
                        </Button>
                        <Button variant="ghost" className="!px-2 !py-1 text-rose-500" onClick={() => deleteEntry("expenses", e.id)} title="Delete">
                          <Trash2 size={14} />
                        </Button>
                      </div>
                    </div>
                  </div>
                ))}
              </>
            )}
          </div>
        </Card>
      </div>

      <Modal open={editOpen} onClose={() => setEditOpen(false)} title="Edit Expense">
        <div className="space-y-3">
          <Input
            label="Title"
            required
            value={editForm.title}
            onChange={(e) => setEditForm({ ...editForm, title: e.target.value })}
          />
          <div className="grid grid-cols-2 gap-3">
            <Input
              label="Amount"
              type="number"
              min={0}
              value={editForm.amount}
              onChange={(e) => setEditForm({ ...editForm, amount: Number(e.target.value) })}
            />
            <Input
              label="Category"
              value={editForm.category}
              onChange={(e) => setEditForm({ ...editForm, category: e.target.value })}
            />
          </div>
          <Select
            label="Paid From"
            value={editForm.paid_from}
            onChange={(e) => setEditForm({ ...editForm, paid_from: e.target.value })}
          >
            <option value="Cash">Cash</option>
            <option value="Bank">Bank</option>
          </Select>
          <TextArea
            label="Notes"
            value={editForm.notes}
            onChange={(e) => setEditForm({ ...editForm, notes: e.target.value })}
          />
          <div className="flex justify-end gap-2">
            <Button variant="secondary" onClick={() => setEditOpen(false)}>Cancel</Button>
            <Button onClick={saveExpenseEdit} disabled={saving}>{saving ? "Saving..." : "Save"}</Button>
          </div>
        </div>
      </Modal>

      <div className="mt-4">
        <Card title="Recent dates with data">
          <div className="overflow-x-auto p-2">
            <table className="w-full min-w-[520px] text-left text-sm">
              <thead>
                <tr className="border-b border-edge text-xs uppercase tracking-wide text-muted">
                  <th className="px-3 py-2">Date</th>
                  <th className="px-3 py-2">Sales</th>
                  <th className="px-3 py-2">Purchases</th>
                  <th className="px-3 py-2">Expenses</th>
                  <th className="px-3 py-2" />
                </tr>
              </thead>
              <tbody>
                {recent.map((r) => (
                  <tr key={r.entry_date} className="border-b border-edge/70">
                    <td className="px-3 py-2.5 font-medium text-ink">{formatDate(r.entry_date)}</td>
                    <td className="px-3 py-2.5">{r.sales_count}</td>
                    <td className="px-3 py-2.5">{r.purchase_count}</td>
                    <td className="px-3 py-2.5">{r.expense_count}</td>
                    <td className="px-3 py-2.5">
                      <button
                        type="button"
                        className="text-sm font-semibold text-brand-600 hover:underline"
                        onClick={() => setDate(r.entry_date)}
                      >
                        Open
                      </button>
                    </td>
                  </tr>
                ))}
                {!recent.length && (
                  <tr>
                    <td colSpan={5} className="px-3 py-8 text-center text-muted">
                      No dated records yet — start by picking a paper date above.
                    </td>
                  </tr>
                )}
              </tbody>
            </table>
          </div>
        </Card>
      </div>
    </div>
  );
}
