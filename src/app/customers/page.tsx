"use client";

import { FormEvent, useEffect, useState } from "react";
import { Pencil, Plus, Trash2 } from "lucide-react";
import { formatMoney } from "@/lib/utils";
import {
  Button,
  Card,
  EmptyState,
  Input,
  Modal,
  PageHeader,
  StatusPill,
  TextArea,
} from "@/components/ui";
import { ModuleSearch, matchSearch } from "@/components/ModuleSearch";

type Customer = {
  id: number;
  name: string;
  shop_name: string | null;
  phone: string | null;
  address: string | null;
  area: string | null;
  balance: number;
  notes: string | null;
};

const emptyForm = {
  name: "",
  shop_name: "",
  phone: "",
  address: "",
  area: "",
  balance: 0,
  notes: "",
};

export default function CustomersPage() {
  const [customers, setCustomers] = useState<Customer[]>([]);
  const [open, setOpen] = useState(false);
  const [editing, setEditing] = useState<Customer | null>(null);
  const [form, setForm] = useState(emptyForm);
  const [q, setQ] = useState("");
  const [saving, setSaving] = useState(false);

  async function load() {
    const res = await fetch("/api/customers");
    setCustomers(await res.json());
  }

  useEffect(() => {
    load();
  }, []);

  function openCreate() {
    setEditing(null);
    setForm(emptyForm);
    setOpen(true);
  }

  function openEdit(c: Customer) {
    setEditing(c);
    setForm({
      name: c.name,
      shop_name: c.shop_name || "",
      phone: c.phone || "",
      address: c.address || "",
      area: c.area || "",
      balance: c.balance,
      notes: c.notes || "",
    });
    setOpen(true);
  }

  async function save(e: FormEvent) {
    e.preventDefault();
    setSaving(true);
    try {
      const method = editing ? "PUT" : "POST";
      const body = editing ? { ...form, id: editing.id } : form;
      await fetch("/api/customers", {
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
    if (!confirm("Delete this customer?")) return;
    await fetch(`/api/customers?id=${id}`, { method: "DELETE" });
    await load();
  }

  const filtered = customers.filter((c) =>
    matchSearch(`${c.name} ${c.shop_name || ""} ${c.phone || ""} ${c.area || ""}`, q)
  );

  const totalPending = customers.reduce((s, c) => s + (c.balance > 0 ? c.balance : 0), 0);

  return (
    <div>
      <PageHeader
        title="Customers"
        subtitle={`Pending ${formatMoney(totalPending)}`}
        action={
          <Button onClick={openCreate}>
            <Plus size={16} /> Add Customer
          </Button>
        }
      />

      <ModuleSearch
        value={q}
        onChange={setQ}
        placeholder="Search by customer or shop name..."
      />

      {filtered.length === 0 ? (
        <EmptyState message="No customers yet. Add your shops first." />
      ) : (
        <Card>
          <div className="overflow-x-auto">
            <table className="w-full min-w-[900px] text-left text-sm">
              <thead>
                <tr className="border-b border-slate-100">
                  {["Customer", "Shop", "Phone", "Area", "Balance", "Status", "Action"].map((h) => (
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
                {filtered.map((c) => (
                  <tr key={c.id} className="border-b border-slate-50 last:border-0">
                    <td className="px-5 py-3.5">
                      <div className="flex items-center gap-3">
                        <span className="inline-flex h-9 w-9 items-center justify-center rounded-full bg-brand-50 text-sm font-bold text-brand-700">
                          {c.name.charAt(0)}
                        </span>
                        <span className="font-semibold text-slate-800">{c.name}</span>
                      </div>
                    </td>
                    <td className="px-5 py-3.5 text-slate-600">{c.shop_name || "-"}</td>
                    <td className="px-5 py-3.5 text-slate-600">{c.phone || "-"}</td>
                    <td className="px-5 py-3.5 text-slate-600">{c.area || "-"}</td>
                    <td className="px-5 py-3.5 font-semibold text-slate-800">
                      {formatMoney(c.balance)}
                    </td>
                    <td className="px-5 py-3.5">
                      <StatusPill tone={c.balance > 0 ? "amber" : "green"}>
                        {c.balance > 0 ? "Pending" : "Clear"}
                      </StatusPill>
                    </td>
                    <td className="px-5 py-3.5">
                      <div className="flex items-center gap-1">
                        <Button variant="ghost" onClick={() => openEdit(c)} className="!px-2 !py-1.5">
                          <Pencil size={15} />
                        </Button>
                        <Button
                          variant="ghost"
                          onClick={() => remove(c.id)}
                          className="!px-2 !py-1.5 text-rose-500"
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

      <Modal open={open} onClose={() => setOpen(false)} title={editing ? "Edit Customer" : "Add Customer"}>
        <form onSubmit={save} className="space-y-3">
          <Input
            label="Customer Name"
            required
            value={form.name}
            onChange={(e) => setForm({ ...form, name: e.target.value })}
          />
          <Input
            label="Shop Name"
            value={form.shop_name}
            onChange={(e) => setForm({ ...form, shop_name: e.target.value })}
          />
          <div className="grid grid-cols-2 gap-3">
            <Input
              label="Phone"
              value={form.phone}
              onChange={(e) => setForm({ ...form, phone: e.target.value })}
            />
            <Input
              label="Area"
              value={form.area}
              onChange={(e) => setForm({ ...form, area: e.target.value })}
            />
          </div>
          <Input
            label="Address"
            value={form.address}
            onChange={(e) => setForm({ ...form, address: e.target.value })}
          />
          <Input
            label="Opening Balance (pending)"
            type="number"
            value={form.balance}
            onChange={(e) => setForm({ ...form, balance: Number(e.target.value) })}
          />
          <TextArea
            label="Notes"
            value={form.notes}
            onChange={(e) => setForm({ ...form, notes: e.target.value })}
          />
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
