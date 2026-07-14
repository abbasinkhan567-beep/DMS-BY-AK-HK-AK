"use client";

import { FormEvent, useEffect, useState } from "react";
import { Pencil, Plus, Trash2 } from "lucide-react";
import { formatDate } from "@/lib/utils";
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

type Product = { id: number; name: string; size: string; stock: number; location: string };
type Transfer = {
  id: number;
  transfer_date: string;
  product_id: number;
  product_name: string;
  product_size: string;
  from_location: string;
  to_location: string;
  quantity: number;
  notes: string | null;
};

export default function StockTransferPage() {
  const [rows, setRows] = useState<Transfer[]>([]);
  const [products, setProducts] = useState<Product[]>([]);
  const [open, setOpen] = useState(false);
  const [editing, setEditing] = useState<Transfer | null>(null);
  const [form, setForm] = useState({
    transfer_date: new Date().toISOString().slice(0, 10),
    product_id: 0,
    from_location: "main",
    to_location: "Floor 1",
    quantity: 1,
    notes: "",
  });
  const [saving, setSaving] = useState(false);
  const [error, setError] = useState("");
  const [q, setQ] = useState("");

  async function load() {
    const [t, p] = await Promise.all([
      fetch("/api/stock-transfers").then((r) => r.json()),
      fetch("/api/products").then((r) => r.json()),
    ]);
    setRows(t);
    setProducts(p);
  }

  useEffect(() => {
    load();
  }, []);

  async function save(e: FormEvent) {
    e.preventDefault();
    setError("");
    setSaving(true);
    try {
      const res = await fetch("/api/stock-transfers", {
        method: editing ? "PUT" : "POST",
        headers: { "Content-Type": "application/json" },
        body: JSON.stringify(editing ? { ...form, id: editing.id } : form),
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
        title="Stock Transfer"
        subtitle="Transfers"
        action={
          <Button
            onClick={() => {
              setEditing(null);
              setError("");
              setForm({
                transfer_date: new Date().toISOString().slice(0, 10),
                product_id: 0,
                from_location: "main",
                to_location: "Floor 1",
                quantity: 1,
                notes: "",
              });
              setOpen(true);
            }}
          >
            <Plus size={16} /> New Transfer
          </Button>
        }
      />

      <ModuleSearch value={q} onChange={setQ} placeholder="Search by product name..." />

      {rows.filter((r) =>
        matchSearch(`${r.product_name} ${r.product_size} ${r.from_location} ${r.to_location}`, q)
      ).length === 0 ? (
        <EmptyState message={q ? "No transfer found for this search." : "No stock transfers yet."} />
      ) : (
        <Card>
          <div className="overflow-x-auto">
            <table className="w-full min-w-[900px] text-left text-sm">
              <thead>
                <tr className="border-b border-slate-100">
                  {["Date", "Product", "From", "To", "Qty", "Notes", "Action"].map((h) => (
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
                    matchSearch(
                      `${r.product_name} ${r.product_size} ${r.from_location} ${r.to_location}`,
                      q
                    )
                  )
                  .map((r) => (
                  <tr key={r.id} className="border-b border-slate-50">
                    <td className="px-5 py-3.5 text-slate-600">{formatDate(r.transfer_date)}</td>
                    <td className="px-5 py-3.5 font-semibold text-slate-800">
                      {r.product_name} {r.product_size}
                    </td>
                    <td className="px-5 py-3.5 text-slate-600">{r.from_location}</td>
                    <td className="px-5 py-3.5 text-slate-600">{r.to_location}</td>
                    <td className="px-5 py-3.5 font-semibold">{r.quantity}</td>
                    <td className="px-5 py-3.5 text-slate-500">{r.notes || "-"}</td>
                    <td className="px-5 py-3.5">
                      <div className="flex gap-1">
                        <Button
                          variant="ghost"
                          className="!px-2 !py-1.5"
                          onClick={() => {
                            setEditing(r);
                            setForm({
                              transfer_date: r.transfer_date,
                              product_id: r.product_id,
                              from_location: r.from_location,
                              to_location: r.to_location,
                              quantity: r.quantity,
                              notes: r.notes || "",
                            });
                            setOpen(true);
                          }}
                        >
                          <Pencil size={15} />
                        </Button>
                        <Button
                          variant="ghost"
                          className="!px-2 !py-1.5 text-rose-500"
                          onClick={async () => {
                            if (!confirm("Delete transfer?")) return;
                            await fetch(`/api/stock-transfers?id=${r.id}`, { method: "DELETE" });
                            await load();
                          }}
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

      <Modal open={open} onClose={() => setOpen(false)} title={editing ? "Edit Transfer" : "Stock Transfer"}>
        <form onSubmit={save} className="space-y-3">
          <Input
            label="Date"
            type="date"
            value={form.transfer_date}
            onChange={(e) => setForm({ ...form, transfer_date: e.target.value })}
          />
          <Select
            label="Product"
            value={form.product_id || ""}
            onChange={(e) => {
              const id = Number(e.target.value);
              const p = products.find((x) => x.id === id);
              setForm({
                ...form,
                product_id: id,
                from_location: p?.location || form.from_location,
              });
            }}
            disabled={!!editing}
          >
            <option value="">Select...</option>
            {products.map((p) => (
              <option key={p.id} value={p.id}>
                {p.name} {p.size} (stock: {p.stock})
              </option>
            ))}
          </Select>
          <div className="grid grid-cols-2 gap-3">
            <Input
              label="From Location"
              value={form.from_location}
              onChange={(e) => setForm({ ...form, from_location: e.target.value })}
            />
            <Input
              label="To Location"
              value={form.to_location}
              onChange={(e) => setForm({ ...form, to_location: e.target.value })}
            />
          </div>
          {!editing && (
            <Input
              label="Quantity"
              type="number"
              min={1}
              value={form.quantity}
              onChange={(e) => setForm({ ...form, quantity: Number(e.target.value) })}
            />
          )}
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
