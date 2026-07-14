"use client";

import { FormEvent, useEffect, useMemo, useState } from "react";
import { FileSpreadsheet, FileText, Pencil, Plus, Trash2 } from "lucide-react";
import { formatMoney, formatDate } from "@/lib/utils";
import { excelSaleBill, printSaleBill } from "@/lib/bills";
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

type Product = { id: number; name: string; size: string; sale_price: number; stock: number };
type Customer = { id: number; name: string; shop_name: string | null };
type Salesman = { id: number; name: string; status: string };

type Sale = {
  id: number;
  invoice_no: string | null;
  sale_date: string;
  total_amount: number;
  paid_amount: number;
  bill_bakaya: number;
  total_commission: number;
  total_discount: number;
  total_bill_expense: number;
  customer_name: string;
  shop_name: string | null;
  salesman_name: string | null;
  item_count: number;
};

type LineItem = {
  product_id: number;
  product_name: string;
  quantity: number;
  unit_price: number;
  commission_rate: number;
  discount_rate: number;
  commission: number;
  discount: number;
};

const emptyLine = (): LineItem => ({
  product_id: 0,
  product_name: "",
  quantity: 1,
  unit_price: 0,
  commission_rate: 0,
  discount_rate: 0,
  commission: 0,
  discount: 0,
});

export default function SalesPage() {
  const [sales, setSales] = useState<Sale[]>([]);
  const [products, setProducts] = useState<Product[]>([]);
  const [customers, setCustomers] = useState<Customer[]>([]);
  const [salesmen, setSalesmen] = useState<Salesman[]>([]);
  const [open, setOpen] = useState(false);
  const [editingId, setEditingId] = useState<number | null>(null);
  const [saving, setSaving] = useState(false);
  const [error, setError] = useState("");
  const [historical, setHistorical] = useState(false);
  const [form, setForm] = useState({
    invoice_no: "",
    customer_id: 0,
    salesman_id: 0,
    sale_date: new Date().toISOString().slice(0, 10),
    paid_amount: 0,
    payment_type: "cash",
    bill_bakaya: 0,
    empty_qty: 0,
    bank_account: "",
    expense1_label: "",
    expense1_amount: 0,
    expense2_label: "",
    expense2_amount: 0,
    expense3_label: "",
    expense3_amount: 0,
    notes: "",
  });
  const [items, setItems] = useState<LineItem[]>([emptyLine()]);
  const [q, setQ] = useState("");

  async function load() {
    const [sRes, pRes, cRes, mRes] = await Promise.all([
      fetch("/api/sales"),
      fetch("/api/products"),
      fetch("/api/customers"),
      fetch("/api/salesmen"),
    ]);
    setSales(await sRes.json());
    setProducts(await pRes.json());
    setCustomers(await cRes.json());
    setSalesmen(await mRes.json());
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
      sale_date: d || f.sale_date,
      notes: hist ? "Paper / old record" : f.notes,
    }));
    setItems([emptyLine()]);
    setError("");
    setOpen(true);
  }, []);

  const itemsSubtotal = useMemo(
    () => items.reduce((s, i) => s + i.quantity * i.unit_price, 0),
    [items]
  );
  const totalCommission = useMemo(
    () =>
      items.reduce((s, i) => {
        const rate = Number(i.commission_rate) || 0;
        return s + (rate > 0 ? rate * Number(i.quantity) : Number(i.commission) || 0);
      }, 0),
    [items]
  );
  const totalDiscount = useMemo(
    () =>
      items.reduce((s, i) => {
        const rate = Number(i.discount_rate) || 0;
        return s + (rate > 0 ? rate * Number(i.quantity) : Number(i.discount) || 0);
      }, 0),
    [items]
  );
  const billExpense =
    (Number(form.expense1_amount) || 0) +
    (Number(form.expense2_amount) || 0) +
    (Number(form.expense3_amount) || 0);
  const grandTotal = itemsSubtotal - totalDiscount + billExpense;
  const bakaya = Math.max(0, grandTotal - (Number(form.paid_amount) || 0));

  function openCreate() {
    setEditingId(null);
    setHistorical(false);
    setError("");
    setForm({
      invoice_no: "",
      customer_id: 0,
      salesman_id: 0,
      sale_date: new Date().toISOString().slice(0, 10),
      paid_amount: 0,
      payment_type: "cash",
      bill_bakaya: 0,
      empty_qty: 0,
      bank_account: "",
      expense1_label: "",
      expense1_amount: 0,
      expense2_label: "",
      expense2_amount: 0,
      expense3_label: "",
      expense3_amount: 0,
      notes: "",
    });
    setItems([emptyLine()]);
    setOpen(true);
  }

  async function openEdit(id: number) {
    const bill = await fetch(`/api/sales?id=${id}`).then((r) => r.json());
    setEditingId(id);
    setHistorical(Boolean(bill.is_historical));
    setError("");
    setForm({
      invoice_no: bill.invoice_no || "",
      customer_id: bill.customer_id,
      salesman_id: bill.salesman_id || 0,
      sale_date: bill.sale_date,
      paid_amount: bill.paid_amount || 0,
      payment_type: bill.payment_type || "cash",
      bill_bakaya: bill.bill_bakaya || 0,
      empty_qty: bill.empty_qty || 0,
      bank_account: bill.bank_account || "",
      expense1_label: bill.expense1_label || "",
      expense1_amount: bill.expense1_amount || 0,
      expense2_label: bill.expense2_label || "",
      expense2_amount: bill.expense2_amount || 0,
      expense3_label: bill.expense3_label || "",
      expense3_amount: bill.expense3_amount || 0,
      notes: bill.notes || "",
    });
    setItems(
      (bill.items || []).map(
        (i: LineItem & { commission_rate?: number; discount_rate?: number }) => ({
          product_id: i.product_id,
          product_name: i.product_name || "",
          quantity: i.quantity,
          unit_price: i.unit_price,
          commission_rate: i.commission_rate || 0,
          discount_rate: i.discount_rate || 0,
          commission: i.commission || 0,
          discount: i.discount || 0,
        })
      )
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
            next.unit_price = product.sale_price;
          }
        }
        const qty = Number(next.quantity) || 0;
        const cRate = Number(next.commission_rate) || 0;
        const dRate = Number(next.discount_rate) || 0;
        next.commission = cRate * qty;
        next.discount = dRate * qty;
        return next;
      })
    );
  }

  async function save(e: FormEvent) {
    e.preventDefault();
    setError("");
    if (!form.customer_id) {
      setError("Please select a customer");
      return;
    }
    const validItems = items.filter((i) => i.product_id && i.quantity > 0);
    if (!validItems.length) {
      setError("Please select at least one product");
      return;
    }
    setSaving(true);
    try {
      const res = await fetch("/api/sales", {
        method: editingId ? "PUT" : "POST",
        headers: { "Content-Type": "application/json" },
        body: JSON.stringify({
          ...(editingId ? { id: editingId } : {}),
          ...form,
          salesman_id: form.salesman_id || null,
          bill_bakaya: bakaya,
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
    if (!confirm("Delete this sale?")) return;
    await fetch(`/api/sales?id=${id}`, { method: "DELETE" });
    await load();
  }

  const filtered = sales.filter((s) =>
    matchSearch(
      `${s.customer_name} ${s.shop_name || ""} ${s.salesman_name || ""} ${s.invoice_no || ""}`,
      q
    )
  );

  return (
    <div>
      <PageHeader
        title="Sales"
        subtitle="Sales"
        action={
          <Button onClick={openCreate}>
            <Plus size={16} /> Add Sale
          </Button>
        }
      />

      <ModuleSearch
        value={q}
        onChange={setQ}
        placeholder="Search by customer or salesman name..."
      />

      {filtered.length === 0 ? (
        <EmptyState message={q ? "No sale found for this name." : "No sales yet."} />
      ) : (
        <Card>
          <div className="overflow-x-auto">
            <table className="w-full min-w-[1000px] text-left text-sm">
              <thead>
                <tr className="border-b border-slate-100">
                  {[
                    "Date",
                    "Customer",
                    "Salesman",
                    "Total",
                    "Commission",
                    "Discount",
                    "Expense",
                    "Balance Due",
                    "Status",
                    "Action",
                  ].map((h) => (
                    <th
                      key={h}
                      className="px-4 py-3 text-xs font-semibold uppercase tracking-wide text-slate-400"
                    >
                      {h}
                    </th>
                  ))}
                </tr>
              </thead>
              <tbody>
                {filtered.map((s) => {
                  const tone =
                    (s.bill_bakaya || 0) <= 0 ? "green" : s.paid_amount <= 0 ? "orange" : "amber";
                  const label =
                    (s.bill_bakaya || 0) <= 0 ? "Paid" : s.paid_amount <= 0 ? "Credit" : "Partial";
                  return (
                    <tr key={s.id} className="border-b border-slate-50">
                      <td className="px-4 py-3.5 text-slate-600">{formatDate(s.sale_date)}</td>
                      <td className="px-4 py-3.5 font-semibold text-slate-800">
                        {s.shop_name || s.customer_name}
                      </td>
                      <td className="px-4 py-3.5 text-slate-600">{s.salesman_name || "-"}</td>
                      <td className="px-4 py-3.5 font-semibold">{formatMoney(s.total_amount)}</td>
                      <td className="px-4 py-3.5 text-slate-600">
                        {formatMoney(s.total_commission || 0)}
                      </td>
                      <td className="px-4 py-3.5 text-slate-600">
                        {formatMoney(s.total_discount || 0)}
                      </td>
                      <td className="px-4 py-3.5 text-slate-600">
                        {formatMoney(s.total_bill_expense || 0)}
                      </td>
                      <td className="px-4 py-3.5 text-amber-600 font-medium">
                        {formatMoney(s.bill_bakaya || 0)}
                      </td>
                      <td className="px-4 py-3.5">
                        <StatusPill tone={tone}>{label}</StatusPill>
                      </td>
                      <td className="px-4 py-3.5">
                        <div className="flex gap-1">
                          <Button
                            variant="ghost"
                            className="!px-2 !py-1.5"
                            onClick={() => openEdit(s.id)}
                          >
                            <Pencil size={15} />
                          </Button>
                          <Button
                            variant="ghost"
                            className="!px-2 !py-1.5"
                            onClick={() => printSaleBill(s.id)}
                            title="PDF Print"
                          >
                            <FileText size={15} />
                          </Button>
                          <Button
                            variant="ghost"
                            className="!px-2 !py-1.5"
                            onClick={() => excelSaleBill(s.id)}
                            title="Excel"
                          >
                            <FileSpreadsheet size={15} />
                          </Button>
                          <Button
                            variant="ghost"
                            className="!px-2 !py-1.5 text-rose-500"
                            onClick={() => remove(s.id)}
                          >
                            <Trash2 size={15} />
                          </Button>
                        </div>
                      </td>
                    </tr>
                  );
                })}
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
            ? "Edit Sale"
            : historical
              ? "Add Paper / Old Sale"
              : "Add Sale"
        }
        wide
      >
        <form onSubmit={save} className="space-y-4">
          <div className="grid gap-3 sm:grid-cols-2">
            <Select
              label="Customer *"
              value={form.customer_id || ""}
              onChange={(e) => setForm({ ...form, customer_id: Number(e.target.value) })}
            >
              <option value="">Select customer...</option>
              {customers.map((c) => (
                <option key={c.id} value={c.id}>
                  {c.shop_name ? `${c.shop_name} (${c.name})` : c.name}
                </option>
              ))}
            </Select>
            <Select
              label="Salesman Name"
              value={form.salesman_id || ""}
              onChange={(e) => setForm({ ...form, salesman_id: Number(e.target.value) })}
            >
              <option value="">Select...</option>
              {salesmen
                .filter((s) => s.status === "active")
                .map((s) => (
                  <option key={s.id} value={s.id}>
                    {s.name}
                  </option>
                ))}
            </Select>
            <Input
              label="Invoice No"
              value={form.invoice_no}
              onChange={(e) => setForm({ ...form, invoice_no: e.target.value })}
            />
            <Input
              label="Date"
              type="date"
              value={form.sale_date}
              onChange={(e) => setForm({ ...form, sale_date: e.target.value })}
            />
            <Input
              label="Bank Account"
              value={form.bank_account}
              onChange={(e) => setForm({ ...form, bank_account: e.target.value })}
            />
            <Input
              label="Empty"
              type="number"
              min={0}
              value={form.empty_qty}
              onChange={(e) => setForm({ ...form, empty_qty: Number(e.target.value) })}
            />
            <Input
              label="Paid Amount"
              type="number"
              min={0}
              value={form.paid_amount}
              onChange={(e) => setForm({ ...form, paid_amount: Number(e.target.value) })}
            />
            <Input
              label="Bill Balance Due"
              type="number"
              value={bakaya}
              readOnly
            />
          </div>

          <div className="space-y-2">
            <div className="flex items-center justify-between">
              <p className="text-xs font-semibold uppercase tracking-wide text-slate-500">
                Products (commission + discount har line pe)
              </p>
              <Button
                type="button"
                variant="secondary"
                className="!py-1.5 !text-xs"
                onClick={() => setItems([...items, emptyLine()])}
              >
                + Add Line
              </Button>
            </div>
            {items.map((item, index) => (
              <div key={index} className="space-y-2 rounded-xl bg-slate-50 p-3">
                <div className="grid gap-2 sm:grid-cols-12">
                  <div className="sm:col-span-4">
                    <Select
                      label="Product Name"
                      value={item.product_id || ""}
                      onChange={(e) => updateItem(index, { product_id: Number(e.target.value) })}
                    >
                      <option value="">Select...</option>
                      {products.map((p) => (
                        <option key={p.id} value={p.id}>
                          {p.name} {p.size} (stock: {p.stock})
                        </option>
                      ))}
                    </Select>
                  </div>
                  <div className="sm:col-span-2">
                    <Input
                      label="Qty (Carton)"
                      type="number"
                      min={1}
                      value={item.quantity}
                      onChange={(e) => updateItem(index, { quantity: Number(e.target.value) })}
                    />
                  </div>
                  <div className="sm:col-span-2">
                    <Input
                      label="Rate"
                      type="number"
                      min={0}
                      value={item.unit_price}
                      onChange={(e) => updateItem(index, { unit_price: Number(e.target.value) })}
                    />
                  </div>
                  <div className="sm:col-span-2">
                    <Input
                      label="Comm / unit"
                      type="number"
                      min={0}
                      value={item.commission_rate}
                      onChange={(e) =>
                        updateItem(index, { commission_rate: Number(e.target.value) })
                      }
                      placeholder="e.g. 2"
                    />
                  </div>
                  <div className="sm:col-span-2">
                    <div className="flex items-end gap-1">
                      <Input
                        label="Disc / unit"
                        type="number"
                        min={0}
                        value={item.discount_rate}
                        onChange={(e) =>
                          updateItem(index, { discount_rate: Number(e.target.value) })
                        }
                        placeholder="e.g. 2"
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
                <div className="flex flex-wrap gap-4 px-1 text-xs text-slate-600">
                  <span>
                    Commission:{" "}
                    <strong className="text-brand-700">{formatMoney(item.commission)}</strong>
                  </span>
                  <span>
                    Discount:{" "}
                    <strong className="text-amber-600">{formatMoney(item.discount)}</strong>
                  </span>
                </div>
              </div>
            ))}
          </div>

          <div>
            <p className="mb-2 text-xs font-semibold uppercase tracking-wide text-slate-500">
              Bill Expenses
            </p>
            <div className="grid gap-2 sm:grid-cols-3">
              {[1, 2, 3].map((n) => (
                <div key={n} className="grid grid-cols-2 gap-2 rounded-xl bg-slate-50 p-3">
                  <Input
                    label={`Expense ${n} Name`}
                    value={form[`expense${n}_label` as keyof typeof form] as string}
                    onChange={(e) =>
                      setForm({ ...form, [`expense${n}_label`]: e.target.value } as typeof form)
                    }
                    placeholder="e.g. Transport"
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

          <TextArea
            label="Notes"
            value={form.notes}
            onChange={(e) => setForm({ ...form, notes: e.target.value })}
          />

          <div className="grid gap-2 rounded-xl bg-brand-50 p-4 text-sm sm:grid-cols-2">
            <div className="flex justify-between">
              <span>Items Subtotal</span>
              <strong>{formatMoney(itemsSubtotal)}</strong>
            </div>
            <div className="flex justify-between">
              <span>Total Commission</span>
              <strong>{formatMoney(totalCommission)}</strong>
            </div>
            <div className="flex justify-between">
              <span>Total Discount</span>
              <strong>{formatMoney(totalDiscount)}</strong>
            </div>
            <div className="flex justify-between">
              <span>Bill Expense</span>
              <strong>{formatMoney(billExpense)}</strong>
            </div>
            <div className="flex justify-between">
              <span>Bill Balance Due</span>
              <strong className="text-amber-600">{formatMoney(bakaya)}</strong>
            </div>
            <div className="flex justify-between text-base">
              <span className="font-semibold">Bill Total</span>
              <strong className="text-brand-700">{formatMoney(grandTotal)}</strong>
            </div>
          </div>

          {error && <p className="text-sm text-rose-500">{error}</p>}

          <div className="flex justify-end gap-2">
            <Button variant="secondary" type="button" onClick={() => setOpen(false)}>
              Cancel
            </Button>
            <Button type="submit" disabled={saving}>
              {saving ? "Saving..." : "Save Sale"}
            </Button>
          </div>
        </form>
      </Modal>
    </div>
  );
}
