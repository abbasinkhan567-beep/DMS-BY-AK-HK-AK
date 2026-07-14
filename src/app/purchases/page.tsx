"use client";

import { FormEvent, useEffect, useMemo, useState } from "react";
import { FileSpreadsheet, FileText, Pencil, Plus, Trash2 } from "lucide-react";
import { formatMoney, formatDate } from "@/lib/utils";
import { excelPurchaseBill, printPurchaseBill } from "@/lib/bills";
import {
  Button,
  Card,
  EmptyState,
  Input,
  Modal,
  PageHeader,
  Select,
  StatusPill,
  TextArea,
} from "@/components/ui";
import { ModuleSearch, matchSearch } from "@/components/ModuleSearch";

type Product = {
  id: number;
  name: string;
  size: string;
  purchase_price: number;
  stock: number;
};

type Purchase = {
  id: number;
  invoice_no: string | null;
  supplier: string;
  company_name: string | null;
  purchase_date: string;
  total_amount: number;
  paid_amount: number;
  item_count: number;
};

type LineItem = {
  product_id: number;
  product_name: string;
  company_name: string;
  size: string;
  quantity: number;
  hand_to_hand: number;
  conditional: number;
  rate_per_cotton: number;
  total_rate: number;
};

const emptyLine = (): LineItem => ({
  product_id: 0,
  product_name: "",
  company_name: "Pepsi Company",
  size: "",
  quantity: 1,
  hand_to_hand: 0,
  conditional: 0,
  rate_per_cotton: 0,
  total_rate: 0,
});

export default function PurchasesPage() {
  const [purchases, setPurchases] = useState<Purchase[]>([]);
  const [products, setProducts] = useState<Product[]>([]);
  const [open, setOpen] = useState(false);
  const [editingId, setEditingId] = useState<number | null>(null);
  const [saving, setSaving] = useState(false);
  const [error, setError] = useState("");
  const [historical, setHistorical] = useState(false);
  const [form, setForm] = useState({
    invoice_no: "",
    supplier: "Pepsi Company",
    company_name: "Pepsi Company",
    purchase_date: new Date().toISOString().slice(0, 10),
    paid_amount: 0,
    notes: "",
    expense1_label: "",
    expense1_amount: 0,
    expense2_label: "",
    expense2_amount: 0,
    expense3_label: "",
    expense3_amount: 0,
  });
  const [items, setItems] = useState<LineItem[]>([emptyLine()]);
  const [q, setQ] = useState("");

  async function load() {
    const [pRes, prodRes] = await Promise.all([
      fetch("/api/purchases"),
      fetch("/api/products"),
    ]);
    setPurchases(await pRes.json());
    setProducts(await prodRes.json());
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
    setEditingId(null);
    setForm((f) => ({
      ...f,
      purchase_date: d || f.purchase_date,
      notes: hist ? "Paper / old record" : f.notes,
    }));
    setItems([emptyLine()]);
    setError("");
    setOpen(true);
  }, []);

  const total = useMemo(
    () => items.reduce((s, i) => s + (Number(i.total_rate) || Number(i.quantity) * Number(i.rate_per_cotton)), 0),
    [items]
  );
  const purchaseExpense =
    (Number(form.expense1_amount) || 0) +
    (Number(form.expense2_amount) || 0) +
    (Number(form.expense3_amount) || 0);

  function openCreate() {
    setEditingId(null);
    setHistorical(false);
    setError("");
    setForm({
      invoice_no: "",
      supplier: "Pepsi Company",
      company_name: "Pepsi Company",
      purchase_date: new Date().toISOString().slice(0, 10),
      paid_amount: 0,
      notes: "",
      expense1_label: "",
      expense1_amount: 0,
      expense2_label: "",
      expense2_amount: 0,
      expense3_label: "",
      expense3_amount: 0,
    });
    setItems([emptyLine()]);
    setOpen(true);
  }

  async function openEdit(id: number) {
    const bill = await fetch(`/api/purchases?id=${id}`).then((r) => r.json());
    setEditingId(id);
    setHistorical(Boolean(bill.is_historical));
    setError("");
    setForm({
      invoice_no: bill.invoice_no || "",
      supplier: bill.supplier || "",
      company_name: bill.company_name || bill.supplier || "",
      purchase_date: bill.purchase_date,
      paid_amount: bill.paid_amount || 0,
      notes: bill.notes || "",
      expense1_label: bill.expense1_label || "",
      expense1_amount: bill.expense1_amount || 0,
      expense2_label: bill.expense2_label || "",
      expense2_amount: bill.expense2_amount || 0,
      expense3_label: bill.expense3_label || "",
      expense3_amount: bill.expense3_amount || 0,
    });
    setItems(
      (bill.items || []).map((i: LineItem & { unit_price?: number }) => ({
        product_id: i.product_id,
        product_name: i.product_name || "",
        company_name: i.company_name || bill.company_name || "",
        size: i.size || "",
        quantity: i.quantity,
        hand_to_hand: i.hand_to_hand || 0,
        conditional: i.conditional || 0,
        rate_per_cotton: i.rate_per_cotton || i.unit_price || 0,
        total_rate: i.total_rate || i.quantity * (i.rate_per_cotton || i.unit_price || 0),
      }))
    );
    setOpen(true);
  }

  function updateItem(index: number, patch: Partial<LineItem>) {
    setItems((prev) =>
      prev.map((item, i) => {
        if (i !== index) return item;
        const next = { ...item, ...patch };
        if (patch.product_id) {
          const product = products.find((p) => p.id === patch.product_id);
          if (product) {
            next.product_name = product.name;
            next.size = product.size;
            next.rate_per_cotton = product.purchase_price;
            next.company_name = form.company_name || next.company_name;
          }
        }
        const qty = Number(next.quantity) || 0;
        const rate = Number(next.rate_per_cotton) || 0;
        if (patch.quantity !== undefined || patch.rate_per_cotton !== undefined || patch.product_id) {
          next.total_rate = qty * rate;
        }
        return next;
      })
    );
  }

  async function save(e: FormEvent) {
    e.preventDefault();
    setError("");
    const validItems = items.filter((i) => i.product_id && i.quantity > 0);
    if (!validItems.length) {
      setError("Please select at least one product");
      return;
    }
    setSaving(true);
    try {
      const res = await fetch("/api/purchases", {
        method: editingId ? "PUT" : "POST",
        headers: { "Content-Type": "application/json" },
        body: JSON.stringify({
          ...(editingId ? { id: editingId } : {}),
          ...form,
          paid_amount: form.paid_amount || total,
          historical,
          items: validItems,
        }),
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
    if (!confirm("Delete this purchase? Stock will be adjusted.")) return;
    await fetch(`/api/purchases?id=${id}`, { method: "DELETE" });
    await load();
  }

  const filtered = purchases.filter((p) =>
    matchSearch(
      `${p.supplier} ${p.company_name || ""} ${p.invoice_no || ""}`,
      q
    )
  );

  return (
    <div>
      <PageHeader
        title="Purchases"
        subtitle="Purchases"
        action={
          <Button onClick={openCreate}>
            <Plus size={16} /> Add Purchase
          </Button>
        }
      />

      <ModuleSearch value={q} onChange={setQ} placeholder="Search by company or invoice..." />

      {filtered.length === 0 ? (
        <EmptyState message={q ? "No purchase found for this search." : "No purchases yet."} />
      ) : (
        <Card>
          <div className="overflow-x-auto">
            <table className="w-full min-w-[900px] text-left text-sm">
              <thead>
                <tr className="border-b border-slate-100">
                  {["Date", "Invoice", "Company", "Items", "Total", "Paid", "Status", "Action"].map(
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
                {filtered.map((p) => (
                  <tr key={p.id} className="border-b border-slate-50">
                    <td className="px-5 py-3.5 text-slate-600">{formatDate(p.purchase_date)}</td>
                    <td className="px-5 py-3.5 font-semibold text-slate-800">
                      {p.invoice_no || `#${p.id}`}
                    </td>
                    <td className="px-5 py-3.5 text-slate-600">{p.company_name || p.supplier}</td>
                    <td className="px-5 py-3.5 text-slate-600">{p.item_count}</td>
                    <td className="px-5 py-3.5 font-semibold">{formatMoney(p.total_amount)}</td>
                    <td className="px-5 py-3.5 text-slate-600">{formatMoney(p.paid_amount)}</td>
                    <td className="px-5 py-3.5">
                      <StatusPill tone={p.paid_amount >= p.total_amount ? "green" : "amber"}>
                        {p.paid_amount >= p.total_amount ? "Paid" : "Partial"}
                      </StatusPill>
                    </td>
                    <td className="px-5 py-3.5">
                      <div className="flex gap-1">
                        <Button variant="ghost" className="!px-2 !py-1.5" onClick={() => openEdit(p.id)}>
                          <Pencil size={15} />
                        </Button>
                        <Button
                          variant="ghost"
                          className="!px-2 !py-1.5"
                          onClick={() => printPurchaseBill(p.id)}
                          title="PDF Print"
                        >
                          <FileText size={15} />
                        </Button>
                        <Button
                          variant="ghost"
                          className="!px-2 !py-1.5"
                          onClick={() => excelPurchaseBill(p.id)}
                          title="Excel"
                        >
                          <FileSpreadsheet size={15} />
                        </Button>
                        <Button
                          variant="ghost"
                          className="!px-2 !py-1.5 text-rose-500"
                          onClick={() => remove(p.id)}
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
        title={
          editingId
            ? "Edit Purchase"
            : historical
              ? "Add Paper / Old Purchase"
              : "Add Purchase"
        }
        wide
      >
        <form onSubmit={save} className="space-y-4">
          <div className="grid gap-3 sm:grid-cols-2">
            <Input
              label="Invoice No"
              value={form.invoice_no}
              onChange={(e) => setForm({ ...form, invoice_no: e.target.value })}
            />
            <Input
              label="Company Name"
              value={form.company_name}
              onChange={(e) => setForm({ ...form, company_name: e.target.value, supplier: e.target.value })}
            />
            <Input
              label="Date"
              type="date"
              value={form.purchase_date}
              onChange={(e) => setForm({ ...form, purchase_date: e.target.value })}
            />
            <Input
              label="Paid Amount"
              type="number"
              min={0}
              value={form.paid_amount}
              onChange={(e) => setForm({ ...form, paid_amount: Number(e.target.value) })}
            />
          </div>

          <div className="space-y-2">
            <div className="flex items-center justify-between">
              <p className="text-xs font-semibold uppercase tracking-wide text-slate-500">Items</p>
              <Button
                type="button"
                variant="secondary"
                className="!py-1.5 !text-xs"
                onClick={() => setItems([...items, { ...emptyLine(), company_name: form.company_name }])}
              >
                + Add Line
              </Button>
            </div>
            {items.map((item, index) => (
              <div key={index} className="space-y-2 rounded-xl bg-slate-50 p-3">
                <div className="grid gap-2 sm:grid-cols-3">
                  <Select
                    label="Product Name"
                    value={item.product_id || ""}
                    onChange={(e) => updateItem(index, { product_id: Number(e.target.value) })}
                  >
                    <option value="">Select...</option>
                    {products.map((p) => (
                      <option key={p.id} value={p.id}>
                        {p.name} {p.size}
                      </option>
                    ))}
                  </Select>
                  <Input
                    label="Company Name"
                    value={item.company_name}
                    onChange={(e) => updateItem(index, { company_name: e.target.value })}
                  />
                  <Input
                    label="Size"
                    value={item.size}
                    onChange={(e) => updateItem(index, { size: e.target.value })}
                  />
                </div>
                <div className="grid gap-2 sm:grid-cols-5">
                  <Input
                    label="Total Qty"
                    type="number"
                    min={0}
                    value={item.quantity}
                    onChange={(e) => updateItem(index, { quantity: Number(e.target.value) })}
                  />
                  <Input
                    label="Hand to Hand"
                    type="number"
                    min={0}
                    value={item.hand_to_hand}
                    onChange={(e) => updateItem(index, { hand_to_hand: Number(e.target.value) })}
                  />
                  <Input
                    label="Conditional"
                    type="number"
                    min={0}
                    value={item.conditional}
                    onChange={(e) => updateItem(index, { conditional: Number(e.target.value) })}
                  />
                  <Input
                    label="Rate / Carton"
                    type="number"
                    min={0}
                    value={item.rate_per_cotton}
                    onChange={(e) => updateItem(index, { rate_per_cotton: Number(e.target.value) })}
                  />
                  <div className="flex items-end justify-between gap-2">
                    <Input
                      label="Total Rate"
                      type="number"
                      min={0}
                      value={item.total_rate}
                      onChange={(e) => updateItem(index, { total_rate: Number(e.target.value) })}
                    />
                    {items.length > 1 && (
                      <Button
                        type="button"
                        variant="ghost"
                        className="!px-2 text-rose-500"
                        onClick={() => setItems(items.filter((_, i) => i !== index))}
                      >
                        <Trash2 size={16} />
                      </Button>
                    )}
                  </div>
                </div>
              </div>
            ))}
          </div>

          <TextArea
            label="Notes"
            value={form.notes}
            onChange={(e) => setForm({ ...form, notes: e.target.value })}
          />

          <div>
            <p className="mb-2 text-xs font-semibold uppercase tracking-wide text-slate-500">
              Purchase Expenses
            </p>
            <div className="grid gap-2 sm:grid-cols-3">
              {[1, 2, 3].map((n) => (
                <div key={n} className="grid grid-cols-2 gap-2 rounded-xl bg-slate-50 p-3">
                  <Input
                    label={`Expense ${n}`}
                    value={form[`expense${n}_label` as keyof typeof form] as string}
                    onChange={(e) =>
                      setForm({ ...form, [`expense${n}_label`]: e.target.value } as typeof form)
                    }
                    placeholder="Transport / Labour"
                  />
                  <Input
                    label="Amount"
                    type="number"
                    min={0}
                    value={form[`expense${n}_amount` as keyof typeof form] as number}
                    onChange={(e) =>
                      setForm({
                        ...form,
                        [`expense${n}_amount`]: Number(e.target.value),
                      } as typeof form)
                    }
                  />
                </div>
              ))}
            </div>
          </div>

          <div className="flex flex-wrap items-center justify-between gap-2 rounded-xl bg-brand-50 px-4 py-3">
            <span className="font-medium text-slate-700">Items Total</span>
            <span className="text-xl font-bold text-brand-700">{formatMoney(total)}</span>
          </div>
          <div className="flex items-center justify-between text-sm text-slate-600">
            <span>Purchase Expense</span>
            <strong className="text-rose-500">{formatMoney(purchaseExpense)}</strong>
          </div>

          {error && <p className="text-sm text-rose-500">{error}</p>}

          <div className="flex justify-end gap-2">
            <Button variant="secondary" type="button" onClick={() => setOpen(false)}>
              Cancel
            </Button>
            <Button type="submit" disabled={saving}>
              {saving ? "Saving..." : "Save Purchase"}
            </Button>
          </div>
        </form>
      </Modal>
    </div>
  );
}
