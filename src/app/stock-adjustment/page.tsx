"use client";

import { FormEvent, useEffect, useState } from "react";
import { Plus, Trash2 } from "lucide-react";
import { formatDate } from "@/lib/utils";
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

type Product = { id: number; name: string; size: string; stock: number };
type Adjustment = {
  id: number;
  adjust_date: string;
  product_id: number;
  product_name: string;
  product_size: string;
  old_qty: number;
  new_qty: number;
  difference: number;
  reason: string | null;
  notes: string | null;
};

export default function StockAdjustmentPage() {
  const [rows, setRows] = useState<Adjustment[]>([]);
  const [products, setProducts] = useState<Product[]>([]);
  const [open, setOpen] = useState(false);
  const [form, setForm] = useState({
    adjust_date: new Date().toISOString().slice(0, 10),
    product_id: 0,
    new_qty: 0,
    reason: "",
    notes: "",
  });
  const [saving, setSaving] = useState(false);
  const [error, setError] = useState("");
  const [q, setQ] = useState("");

  async function load() {
    const [a, p] = await Promise.all([
      fetch("/api/stock-adjustments").then((r) => r.json()),
      fetch("/api/products").then((r) => r.json()),
    ]);
    setRows(a);
    setProducts(p);
  }

  useEffect(() => {
    load();
  }, []);

  const selected = products.find((p) => p.id === form.product_id);

  async function save(e: FormEvent) {
    e.preventDefault();
    setError("");
    setSaving(true);
    try {
      const res = await fetch("/api/stock-adjustments", {
        method: "POST",
        headers: { "Content-Type": "application/json" },
        body: JSON.stringify(form),
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

  return (
    <div>
      <PageHeader
        title="Stock Adjustment"
        subtitle="Adjustments"
        action={
          <Button
            onClick={() => {
              setError("");
              setForm({
                adjust_date: new Date().toISOString().slice(0, 10),
                product_id: 0,
                new_qty: 0,
                reason: "",
                notes: "",
              });
              setOpen(true);
            }}
          >
            <Plus size={16} /> New Adjustment
          </Button>
        }
      />

      <ModuleSearch value={q} onChange={setQ} placeholder="Search by product name..." />

      {rows.filter((r) =>
        matchSearch(`${r.product_name} ${r.product_size} ${r.reason || ""}`, q)
      ).length === 0 ? (
        <EmptyState message={q ? "No adjustment found for this search." : "No adjustments yet."} />
      ) : (
        <Card>
          <div className="overflow-x-auto">
            <table className="w-full min-w-[900px] text-left text-sm">
              <thead>
                <tr className="border-b border-slate-100">
                  {["Date", "Product", "Old", "New", "Diff", "Reason", "Action"].map((h) => (
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
                {rows
                  .filter((r) =>
                    matchSearch(`${r.product_name} ${r.product_size} ${r.reason || ""}`, q)
                  )
                  .map((r) => (
                  <tr key={r.id} className="border-b border-slate-50">
                    <td className="px-5 py-3.5 text-slate-600">{formatDate(r.adjust_date)}</td>
                    <td className="px-5 py-3.5 font-semibold text-slate-800">
                      {r.product_name} {r.product_size}
                    </td>
                    <td className="px-5 py-3.5">{r.old_qty}</td>
                    <td className="px-5 py-3.5 font-semibold">{r.new_qty}</td>
                    <td className="px-5 py-3.5">
                      <StatusPill tone={r.difference >= 0 ? "green" : "orange"}>
                        {r.difference > 0 ? `+${r.difference}` : r.difference}
                      </StatusPill>
                    </td>
                    <td className="px-5 py-3.5 text-slate-500">{r.reason || "-"}</td>
                    <td className="px-5 py-3.5">
                      <Button
                        variant="ghost"
                        className="!px-2 !py-1.5 text-rose-500"
                        onClick={async () => {
                          if (!confirm("Delete and restore stock to previous quantity?")) return;
                          await fetch(`/api/stock-adjustments?id=${r.id}`, { method: "DELETE" });
                          await load();
                        }}
                      >
                        <Trash2 size={15} />
                      </Button>
                    </td>
                  </tr>
                ))}
              </tbody>
            </table>
          </div>
        </Card>
      )}

      <Modal open={open} onClose={() => setOpen(false)} title="Stock Adjustment">
        <form onSubmit={save} className="space-y-3">
          <Input
            label="Date"
            type="date"
            value={form.adjust_date}
            onChange={(e) => setForm({ ...form, adjust_date: e.target.value })}
          />
          <Select
            label="Product"
            value={form.product_id || ""}
            onChange={(e) => {
              const id = Number(e.target.value);
              const p = products.find((x) => x.id === id);
              setForm({ ...form, product_id: id, new_qty: p?.stock || 0 });
            }}
          >
            <option value="">Select...</option>
            {products.map((p) => (
              <option key={p.id} value={p.id}>
                {p.name} {p.size} (current: {p.stock})
              </option>
            ))}
          </Select>
          {selected && (
            <p className="text-sm text-slate-500">
              Current stock: <strong>{selected.stock}</strong>
            </p>
          )}
          <Input
            label="New Quantity"
            type="number"
            min={0}
            value={form.new_qty}
            onChange={(e) => setForm({ ...form, new_qty: Number(e.target.value) })}
          />
          <Input
            label="Reason"
            value={form.reason}
            onChange={(e) => setForm({ ...form, reason: e.target.value })}
            placeholder="Damage / Count / Shortage"
          />
          <TextArea
            label="Notes"
            value={form.notes}
            onChange={(e) => setForm({ ...form, notes: e.target.value })}
          />
          {error && <p className="text-sm text-rose-500">{error}</p>}
          <div className="flex justify-end gap-2">
            <Button variant="secondary" type="button" onClick={() => setOpen(false)}>
              Cancel
            </Button>
            <Button type="submit" disabled={saving}>
              Save
            </Button>
          </div>
        </form>
      </Modal>
    </div>
  );
}
