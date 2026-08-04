"use client";

import { FormEvent, useEffect, useState } from "react";
import { CalendarDays, Pencil, Plus, Trash2 } from "lucide-react";
import { formatDate, todayLocal } from "@/lib/utils";
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

type Product = { id: number; name: string; size: string; stock: number };

type StockbookItem = {
  id: number;
  product_id: number;
  product_name: string;
  product_size: string | null;
  quantity: number;
};

type Stockbook = {
  id: number;
  book_date: string;
  note: string | null;
  items: StockbookItem[];
};

type LineItem = {
  product_id: number;
  quantity: number;
};

const emptyLine = (): LineItem => ({ product_id: 0, quantity: 0 });

export default function StockbookPage() {
  const [rows, setRows] = useState<Stockbook[]>([]);
  const [products, setProducts] = useState<Product[]>([]);
  const [open, setOpen] = useState(false);
  const [editingId, setEditingId] = useState<number | null>(null);
  const [form, setForm] = useState({ book_date: todayLocal(), note: "" });
  const [lines, setLines] = useState<LineItem[]>([emptyLine()]);
  const [saving, setSaving] = useState(false);
  const [error, setError] = useState("");
  const [q, setQ] = useState("");

  async function load() {
    const [s, p] = await Promise.all([fetch("/api/stockbook"), fetch("/api/products")]);
    if (s.ok) setRows(await s.json());
    if (p.ok) setProducts(await p.json());
  }

  useEffect(() => {
    load();
  }, []);

  function openCreate() {
    setEditingId(null);
    setError("");
    setForm({ book_date: todayLocal(), note: "" });
    setLines([emptyLine()]);
    setOpen(true);
  }

  async function openEdit(id: number) {
    const sb = await fetch(`/api/stockbook?id=${id}`).then((r) => r.json());
    setEditingId(id);
    setError("");
    setForm({ book_date: sb.book_date, note: sb.note || "" });
    setLines(
      (sb.items || []).map((i: StockbookItem) => ({
        product_id: i.product_id,
        quantity: i.quantity,
      }))
    );
    setOpen(true);
  }

  function updateLine(index: number, patch: Partial<LineItem>) {
    setLines((prev) =>
      prev.map((line, i) => {
        if (i !== index) return line;
        const next = { ...line, ...patch };
        if (patch.product_id) {
          const product = products.find((p) => p.id === patch.product_id);
          if (product && !patch.quantity) next.quantity = product.stock;
        }
        return next;
      })
    );
  }

  async function save(e: FormEvent) {
    e.preventDefault();
    setError("");
    const valid = lines.filter((l) => l.product_id && l.quantity > 0);
    if (!valid.length) {
      setError("Please add at least one product with a quantity");
      return;
    }
    setSaving(true);
    try {
      const res = await fetch("/api/stockbook", {
        method: editingId ? "PUT" : "POST",
        headers: { "Content-Type": "application/json" },
        body: JSON.stringify({ ...(editingId ? { id: editingId } : {}), ...form, items: valid }),
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
    if (!confirm("Delete this day's stockbook?")) return;
    const res = await fetch(`/api/stockbook?id=${id}`, { method: "DELETE" });
    if (!res.ok) {
      const data = await res.json().catch(() => ({}));
      setError(data.error || "Delete failed");
      return;
    }
    await load();
  }

  const filtered = rows.filter((r) => {
    const itemsText = (r.items || [])
      .map((i) => `${i.product_name} ${i.product_size || ""}`)
      .join(" ");
    return matchSearch(`${r.book_date} ${r.note || ""} ${itemsText}`, q);
  });

  return (
    <div>
      <PageHeader
        title="Stockbook"
        subtitle="Daily stock record"
        action={
          <Button onClick={openCreate}>
            <Plus size={16} /> New Day
          </Button>
        }
      />

      <ModuleSearch
        value={q}
        onChange={setQ}
        placeholder="Search by date, product or note..."
      />

      {filtered.length === 0 ? (
        <EmptyState
          message={
            q ? "No stockbook entry found for this search." : "No stockbook entries yet. Add today's stock."
          }
        />
      ) : (
        <div className="space-y-4">
          {filtered.map((r) => {
            const total = (r.items || []).reduce((s, i) => s + i.quantity, 0);
            return (
              <Card key={r.id}>
                <div className="flex flex-wrap items-center justify-between gap-2 border-b border-slate-100 px-5 py-4">
                  <div className="flex items-center gap-3">
                    <span className="inline-flex h-9 w-9 items-center justify-center rounded-xl bg-brand-50 text-brand-700">
                      <CalendarDays size={17} />
                    </span>
                    <div>
                      <p className="font-bold text-slate-800">{formatDate(r.book_date)}</p>
                      <p className="text-xs text-slate-500">
                        {r.items.length} product{(r.items || []).length === 1 ? "" : "s"} · {total} total qty
                      </p>
                    </div>
                  </div>
                  <div className="flex gap-1">
                    <Button
                      variant="ghost"
                      className="!px-2 !py-1.5"
                      onClick={() => openEdit(r.id)}
                    >
                      <Pencil size={15} />
                    </Button>
                    <Button
                      variant="ghost"
                      className="!px-2 !py-1.5 text-rose-500"
                      onClick={() => remove(r.id)}
                    >
                      <Trash2 size={15} />
                    </Button>
                  </div>
                </div>
                <div className="overflow-x-auto">
                  <table className="w-full text-left text-sm">
                    <thead>
                      <tr className="border-b border-slate-100">
                        {["Product", "Quantity"].map((h) => (
                          <th
                            key={h}
                            className="px-5 py-2.5 text-xs font-semibold uppercase tracking-wide text-slate-400"
                          >
                            {h}
                          </th>
                        ))}
                      </tr>
                    </thead>
                    <tbody>
                      {(r.items || []).map((i) => (
                        <tr key={i.id} className="border-b border-slate-50 last:border-0">
                          <td className="px-5 py-3 font-semibold text-slate-800">
                            {i.product_name} {i.product_size ? `(${i.product_size})` : ""}
                          </td>
                          <td className="px-5 py-3">{i.quantity}</td>
                        </tr>
                      ))}
                    </tbody>
                  </table>
                </div>
                {r.note && (
                  <div className="border-t border-slate-100 bg-surface-muted px-5 py-3 text-sm text-slate-600">
                    <span className="font-semibold text-slate-700">Note: </span>
                    {r.note}
                  </div>
                )}
              </Card>
            );
          })}
        </div>
      )}

      <Modal
        open={open}
        onClose={() => setOpen(false)}
        title={editingId ? "Edit Stockbook" : "New Stockbook Day"}
        wide
      >
        <form onSubmit={save} className="space-y-4">
          <div className="grid gap-3 sm:grid-cols-2">
            <Input
              label="Date *"
              type="date"
              value={form.book_date}
              onChange={(e) => setForm({ ...form, book_date: e.target.value })}
            />
            <div className="flex items-end">
              <p className="text-xs text-slate-500">
                Product select karo — current stock khud fill hoga, aap change bhi kar sakte ho.
              </p>
            </div>
          </div>

          <div className="space-y-2">
            <div className="flex items-center justify-between">
              <p className="text-xs font-semibold uppercase tracking-wide text-slate-500">
                Products (stock of the day)
              </p>
              <Button
                type="button"
                variant="secondary"
                className="!py-1.5 !text-xs"
                onClick={() => setLines([...lines, emptyLine()])}
              >
                + Add Line
              </Button>
            </div>
            {lines.map((line, index) => (
              <div key={index} className="grid gap-2 rounded-xl bg-slate-50 p-3 sm:grid-cols-12">
                <div className="sm:col-span-8">
                  <Select
                    label="Product"
                    value={line.product_id || ""}
                    onChange={(e) => updateLine(index, { product_id: Number(e.target.value) })}
                  >
                    <option value="">Select...</option>
                    {products.map((p) => (
                      <option key={p.id} value={p.id}>
                        {p.name} {p.size} (current: {p.stock})
                      </option>
                    ))}
                  </Select>
                </div>
                <div className="sm:col-span-3">
                  <Input
                    label="Quantity"
                    type="number"
                    min={0}
                    value={line.quantity}
                    onChange={(e) => updateLine(index, { quantity: Number(e.target.value) })}
                  />
                </div>
                <div className="flex items-end sm:col-span-1">
                  {lines.length > 1 && (
                    <Button
                      type="button"
                      variant="ghost"
                      className="!px-2 text-rose-500"
                      onClick={() => setLines(lines.filter((_, i) => i !== index))}
                    >
                      <Trash2 size={16} />
                    </Button>
                  )}
                </div>
              </div>
            ))}
          </div>

          <TextArea
            label="Note"
            value={form.note}
            onChange={(e) => setForm({ ...form, note: e.target.value })}
            placeholder="Aaj ka note — koi kami / zyada stock / special baat"
          />

          {error && <p className="text-sm text-rose-500">{error}</p>}

          <div className="flex justify-end gap-2">
            <Button variant="secondary" type="button" onClick={() => setOpen(false)}>
              Cancel
            </Button>
            <Button type="submit" disabled={saving}>
              {saving ? "Saving..." : "Save Stockbook"}
            </Button>
          </div>
        </form>
      </Modal>
    </div>
  );
}
