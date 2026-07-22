"use client";

import { FormEvent, useEffect, useState } from "react";
import { MoreVertical, Pencil, Plus, Trash2 } from "lucide-react";
import { formatMoney } from "@/lib/utils";
import {
  Button,
  Card,
  EmptyState,
  Input,
  Modal,
  PageHeader,
  Select,
  StatusPill,
} from "@/components/ui";
import { ModuleSearch, matchSearch } from "@/components/ModuleSearch";

type Product = {
  id: number;
  name: string;
  size: string;
  unit: string;
  purchase_price: number;
  sale_price: number;
  stock: number;
  min_stock: number;
};

const emptyForm = {
  name: "",
  size: "",
  unit: "bottle",
  purchase_price: 0,
  sale_price: 0,
  stock: 0,
  min_stock: 10,
};

export default function ProductsPage() {
  const [products, setProducts] = useState<Product[]>([]);
  const [open, setOpen] = useState(false);
  const [editing, setEditing] = useState<Product | null>(null);
  const [form, setForm] = useState(emptyForm);
  const [q, setQ] = useState("");
  const [saving, setSaving] = useState(false);

  async function load() {
    const res = await fetch("/api/products");
    setProducts(await res.json());
  }

  useEffect(() => {
    load();
  }, []);

  function openCreate() {
    setEditing(null);
    setForm(emptyForm);
    setOpen(true);
  }

  function openEdit(p: Product) {
    setEditing(p);
    setForm({
      name: p.name,
      size: p.size,
      unit: p.unit,
      purchase_price: p.purchase_price,
      sale_price: p.sale_price,
      stock: p.stock,
      min_stock: p.min_stock,
    });
    setOpen(true);
  }

  async function save(e: FormEvent) {
    e.preventDefault();
    setSaving(true);
    try {
      const method = editing ? "PUT" : "POST";
      const body = editing ? { ...form, id: editing.id } : form;
      await fetch("/api/products", {
        method,
        headers: { "Content-Type": "application/json" },
        body: JSON.stringify(body),
      });
      setOpen(false);
      await load();
    } finally {
      setSaving(false);
    }
  }

  async function remove(id: number) {
    if (!confirm("Delete this product?")) return;
    await fetch(`/api/products?id=${id}`, { method: "DELETE" });
    await load();
  }

  const filtered = products.filter((p) => matchSearch(`${p.name} ${p.size}`, q));

  return (
    <div>
      <PageHeader
        title="Products / Stock"
        subtitle="Inventory"
        action={
          <Button onClick={openCreate}>
            <Plus size={16} /> Add Product
          </Button>
        }
      />

      <ModuleSearch value={q} onChange={setQ} placeholder="Search by product name..." />

      {filtered.length === 0 ? (
        <EmptyState message="No products found. Add products first." />
      ) : (
        <Card>
          <div className="overflow-x-auto">
            <table className="w-full min-w-[900px] text-left text-sm">
              <thead>
                <tr className="border-b border-slate-100">
                  {["Product", "Size", "Purchase", "Sale", "Stock", "Status", "Action"].map((h) => (
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
                {filtered.map((p) => {
                  const low = p.stock <= p.min_stock;
                  return (
                    <tr key={p.id} className="border-b border-slate-50 last:border-0">
                      <td className="px-5 py-3.5">
                        <div className="flex items-center gap-3">
                          <span className="inline-flex h-9 w-9 items-center justify-center rounded-full bg-brand-50 text-sm font-bold text-brand-700">
                            {(p.name || "?").charAt(0)}
                          </span>
                          <span className="font-semibold text-slate-800">{p.name}</span>
                        </div>
                      </td>
                      <td className="px-5 py-3.5 text-slate-600">{p.size}</td>
                      <td className="px-5 py-3.5 text-slate-600">{formatMoney(p.purchase_price)}</td>
                      <td className="px-5 py-3.5 text-slate-600">{formatMoney(p.sale_price)}</td>
                      <td className="px-5 py-3.5 font-semibold text-slate-800">{p.stock}</td>
                      <td className="px-5 py-3.5">
                        <StatusPill tone={low ? "orange" : "green"}>
                          {low ? "Low stock" : "In stock"}
                        </StatusPill>
                      </td>
                      <td className="px-5 py-3.5">
                        <div className="flex items-center gap-1">
                          <Button variant="ghost" onClick={() => openEdit(p)} className="!px-2 !py-1.5">
                            <Pencil size={15} />
                          </Button>
                          <Button
                            variant="ghost"
                            onClick={() => remove(p.id)}
                            className="!px-2 !py-1.5 text-rose-500"
                          >
                            <Trash2 size={15} />
                          </Button>
                          <span className="p-1.5 text-slate-300">
                            <MoreVertical size={15} />
                          </span>
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

      <Modal open={open} onClose={() => setOpen(false)} title={editing ? "Edit Product" : "Add Product"}>
        <form onSubmit={save} className="space-y-3">
          <Input
            label="Name"
            required
            value={form.name}
            onChange={(e) => setForm({ ...form, name: e.target.value })}
            placeholder="Pepsi"
          />
          <div className="grid grid-cols-2 gap-3">
            <Input
              label="Size"
              required
              value={form.size}
              onChange={(e) => setForm({ ...form, size: e.target.value })}
              placeholder="1.5L"
            />
            <Select
              label="Unit"
              value={form.unit}
              onChange={(e) => setForm({ ...form, unit: e.target.value })}
            >
              <option value="bottle">Bottle</option>
              <option value="crate">Crate</option>
              <option value="pack">Pack</option>
              <option value="can">Can</option>
            </Select>
          </div>
          <div className="grid grid-cols-2 gap-3">
            <Input
              label="Purchase Price"
              type="number"
              min={0}
              value={form.purchase_price}
              onChange={(e) => setForm({ ...form, purchase_price: Number(e.target.value) })}
            />
            <Input
              label="Sale Price"
              type="number"
              min={0}
              value={form.sale_price}
              onChange={(e) => setForm({ ...form, sale_price: Number(e.target.value) })}
            />
          </div>
          <div className="grid grid-cols-2 gap-3">
            <Input
              label="Stock"
              type="number"
              min={0}
              value={form.stock}
              onChange={(e) => setForm({ ...form, stock: Number(e.target.value) })}
            />
            <Input
              label="Min Stock Alert"
              type="number"
              min={0}
              value={form.min_stock}
              onChange={(e) => setForm({ ...form, min_stock: Number(e.target.value) })}
            />
          </div>
          <div className="flex justify-end gap-2 pt-2">
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
