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
  Select,
  StatusPill,
} from "@/components/ui";
import { ModuleSearch, matchSearch } from "@/components/ModuleSearch";

type Salesman = {
  id: number;
  name: string;
  phone: string | null;
  area: string | null;
  salary: number;
  status: string;
};

const emptyForm = {
  name: "",
  phone: "",
  area: "",
  salary: 0,
  status: "active",
};

export default function SalesmenPage() {
  const [salesmen, setSalesmen] = useState<Salesman[]>([]);
  const [open, setOpen] = useState(false);
  const [editing, setEditing] = useState<Salesman | null>(null);
  const [form, setForm] = useState(emptyForm);
  const [saving, setSaving] = useState(false);
  const [q, setQ] = useState("");

  async function load() {
    const res = await fetch("/api/salesmen");
    setSalesmen(await res.json());
  }

  useEffect(() => {
    load();
  }, []);

  function openCreate() {
    setEditing(null);
    setForm(emptyForm);
    setOpen(true);
  }

  function openEdit(s: Salesman) {
    setEditing(s);
    setForm({
      name: s.name,
      phone: s.phone || "",
      area: s.area || "",
      salary: s.salary,
      status: s.status,
    });
    setOpen(true);
  }

  async function save(e: FormEvent) {
    e.preventDefault();
    setSaving(true);
    try {
      const method = editing ? "PUT" : "POST";
      const body = editing ? { ...form, id: editing.id } : form;
      await fetch("/api/salesmen", {
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
    if (!confirm("Delete this salesman?")) return;
    await fetch(`/api/salesmen?id=${id}`, { method: "DELETE" });
    await load();
  }

  const filtered = salesmen.filter((s) =>
    matchSearch(`${s.name} ${s.phone || ""} ${s.area || ""} ${s.status}`, q)
  );

  return (
    <div>
      <PageHeader
        title="Salesmen"
        subtitle="Team"
        action={
          <Button onClick={openCreate}>
            <Plus size={16} /> Add Salesman
          </Button>
        }
      />

      <ModuleSearch value={q} onChange={setQ} placeholder="Search by salesman name..." />

      {filtered.length === 0 ? (
        <EmptyState message={q ? "No salesman found for this name." : "No salesmen yet. Add your team first."} />
      ) : (
        <Card>
          <div className="overflow-x-auto">
            <table className="w-full min-w-[780px] text-left text-sm">
              <thead>
                <tr className="border-b border-slate-100">
                  {["Name", "Phone", "Area", "Salary", "Status", "Action"].map((h) => (
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
                {filtered.map((s) => (
                  <tr key={s.id} className="border-b border-slate-50 last:border-0">
                    <td className="px-5 py-3.5">
                      <div className="flex items-center gap-3">
                        <span className="inline-flex h-9 w-9 items-center justify-center rounded-full bg-brand-50 text-sm font-bold text-brand-700">
                          {s.name.charAt(0)}
                        </span>
                        <span className="font-semibold text-slate-800">{s.name}</span>
                      </div>
                    </td>
                    <td className="px-5 py-3.5 text-slate-600">{s.phone || "-"}</td>
                    <td className="px-5 py-3.5 text-slate-600">{s.area || "-"}</td>
                    <td className="px-5 py-3.5 text-slate-600">{formatMoney(s.salary)}</td>
                    <td className="px-5 py-3.5">
                      <StatusPill tone={s.status === "active" ? "green" : "slate"}>
                        {s.status === "active" ? "Active" : "Inactive"}
                      </StatusPill>
                    </td>
                    <td className="px-5 py-3.5">
                      <div className="flex items-center gap-1">
                        <Button variant="ghost" onClick={() => openEdit(s)} className="!px-2 !py-1.5">
                          <Pencil size={15} />
                        </Button>
                        <Button
                          variant="ghost"
                          onClick={() => remove(s.id)}
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

      <Modal open={open} onClose={() => setOpen(false)} title={editing ? "Edit Salesman" : "Add Salesman"}>
        <form onSubmit={save} className="space-y-3">
          <Input
            label="Name"
            required
            value={form.name}
            onChange={(e) => setForm({ ...form, name: e.target.value })}
          />
          <div className="grid grid-cols-2 gap-3">
            <Input
              label="Phone"
              value={form.phone}
              onChange={(e) => setForm({ ...form, phone: e.target.value })}
            />
            <Input
              label="Area / Route"
              value={form.area}
              onChange={(e) => setForm({ ...form, area: e.target.value })}
            />
          </div>
          <div className="grid grid-cols-2 gap-3">
            <Input
              label="Salary"
              type="number"
              min={0}
              value={form.salary}
              onChange={(e) => setForm({ ...form, salary: Number(e.target.value) })}
            />
            <Select
              label="Status"
              value={form.status}
              onChange={(e) => setForm({ ...form, status: e.target.value })}
            >
              <option value="active">Active</option>
              <option value="inactive">Inactive</option>
            </Select>
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
