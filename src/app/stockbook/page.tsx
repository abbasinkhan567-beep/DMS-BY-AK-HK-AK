"use client";

import { FormEvent, useEffect, useMemo, useState } from "react";
import { CalendarDays, Pencil, Plus, Printer, Trash2, X } from "lucide-react";
import { formatDate, todayLocal } from "@/lib/utils";
import { printStockbookBill } from "@/lib/bills";
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

type Product = { id: number; name: string; size: string | null };
type Salesman = { id: number; name: string };

type StockbookItem = {
  product_id: number;
  product_name: string;
  product_size: string | null;
  opening_stock: number;
  floor_stock: number;
  stock_from_company: number;
  closing_stock: number;
};

type StockbookSale = {
  salesman_id: number;
  salesman_name: string;
  product_id: number;
  qty: number;
};

type SavedDay = {
  id: number;
  book_date: string;
  note: string | null;
  items: StockbookItem[];
  sales: StockbookSale[];
};

type SalesmanRow = {
  salesman_id: number;
  qty: Record<number, number>;
};

const emptySalesmanRow = (): SalesmanRow => ({ salesman_id: 0, qty: {} });

const money = (v: number | undefined) => Number(v) || 0;

export default function StockbookPage() {
  const [rows, setRows] = useState<SavedDay[]>([]);
  const [allProducts, setAllProducts] = useState<Product[]>([]);
  const [allSalesmen, setAllSalesmen] = useState<Salesman[]>([]);
  const [company, setCompany] = useState<{ name?: string; phone?: string; address?: string }>({});
  const [open, setOpen] = useState(false);
  const [editingId, setEditingId] = useState<number | null>(null);
  const [form, setForm] = useState({ book_date: todayLocal(), note: "" });
  const [cols, setCols] = useState<Product[]>([]);
  const [opening, setOpening] = useState<Record<number, number>>({});
  const [companyIn, setCompanyIn] = useState<Record<number, number>>({});
  const [saleRows, setSaleRows] = useState<SalesmanRow[]>([emptySalesmanRow()]);
  const [addProductId, setAddProductId] = useState(0);
  const [saving, setSaving] = useState(false);
  const [error, setError] = useState("");
  const [q, setQ] = useState("");

  async function load() {
    const [s, p, sm, cp] = await Promise.all([
      fetch("/api/stockbook"),
      fetch("/api/products"),
      fetch("/api/salesmen"),
      fetch("/api/settings"),
    ]);
    if (s.ok) setRows(await s.json());
    if (p.ok) setProducts(await p.json());
    if (sm.ok) setSalesmen(await sm.json());
    if (cp.ok) {
      const d = await cp.json();
      setCompany(d.company || {});
    }
  }

  function setProducts(list: Product[]) {
    setAllProducts(list);
  }

  function setSalesmen(list: Salesman[]) {
    setAllSalesmen(list);
  }

  useEffect(() => {
    load();
  }, []);

  function resetForm(date: string) {
    setForm({ book_date: date, note: "" });
    setCols([]);
    setOpening({});
    setCompanyIn({});
    setSaleRows([emptySalesmanRow()]);
    setAddProductId(0);
    setError("");
  }

  async function computeAuto(date: string) {
    try {
      const res = await fetch(`/api/stockbook?date=${encodeURIComponent(date)}&compute=1`);
      if (!res.ok) return;
      const d = await res.json();
      setCols(d.products || []);
      setOpening(d.opening || {});
      setCompanyIn(d.stock_from_company || {});
    } catch {
      /* ignore */
    }
  }

  function openCreate() {
    setEditingId(null);
    resetForm(todayLocal());
    setSaleRows([emptySalesmanRow()]);
    setOpen(true);
    computeAuto(todayLocal());
  }

  async function openEdit(id: number) {
    const sb = await fetch(`/api/stockbook?id=${id}`).then((r) => r.json());
    setEditingId(id);
    setError("");
    setForm({ book_date: sb.book_date, note: sb.note || "" });
    const items = sb.items || [];
    const sales = sb.sales || [];
    setCols(
      items.map((i: StockbookItem) => ({
        id: i.product_id,
        name: i.product_name,
        size: i.product_size,
      }))
    );
    const openingMap: Record<number, number> = {};
    const companyMap: Record<number, number> = {};
    for (const i of items) {
      openingMap[i.product_id] = money(i.opening_stock);
      companyMap[i.product_id] = money(i.stock_from_company);
    }
    setOpening(openingMap);
    setCompanyIn(companyMap);
    const bySalesman = new Map<number, Record<number, number>>();
    for (const s of sales) {
      if (!bySalesman.has(s.salesman_id)) bySalesman.set(s.salesman_id, {});
      bySalesman.get(s.salesman_id)![s.product_id] = money(s.qty);
    }
    const rows2 = [...bySalesman.entries()].map(([sid, qty]) => ({ salesman_id: sid, qty }));
    setSaleRows(rows2.length ? rows2 : [emptySalesmanRow()]);
    setAddProductId(0);
    setOpen(true);
  }

  function onDateChange(date: string) {
    setForm({ ...form, book_date: date });
    if (!editingId) {
      setCols([]);
      computeAuto(date);
    }
  }

  function addColumn(pid: number) {
    if (!pid || cols.some((c) => c.id === pid)) return;
    const p = allProducts.find((x) => x.id === pid);
    if (!p) return;
    setCols([...cols, { id: p.id, name: p.name, size: p.size }]);
    setAddProductId(0);
  }

  function removeColumn(pid: number) {
    setCols(cols.filter((c) => c.id !== pid));
    setOpening((o) => {
      const n = { ...o };
      delete n[pid];
      return n;
    });
    setCompanyIn((o) => {
      const n = { ...o };
      delete n[pid];
      return n;
    });
    setSaleRows((prev) => prev.map((r) => ({ ...r, qty: omitKey(r.qty, pid) })));
  }

  function omitKey(map: Record<number, number>, key: number) {
    const n = { ...map };
    delete n[key];
    return n;
  }

  function updateSaleQty(rowIdx: number, pid: number, val: number) {
    setSaleRows((prev) =>
      prev.map((r, i) =>
        i === rowIdx ? { ...r, qty: { ...r.qty, [pid]: val } } : r
      )
    );
  }

  function rowTotal(r: SalesmanRow) {
    return cols.reduce((s, c) => s + money(r.qty[c.id]), 0);
  }

  function totalSaleFor(pid: number) {
    return saleRows.reduce((s, r) => s + money(r.qty[pid]), 0);
  }

  function floorAutoFor(pid: number) {
    return Math.max(0, money(opening[pid]) - totalSaleFor(pid));
  }

  function closingFor(pid: number) {
    return floorAutoFor(pid) + money(companyIn[pid]);
  }

  const grandTotalSale = useMemo(
    () => cols.reduce((s, c) => s + totalSaleFor(c.id), 0),
    [cols, saleRows]
  );
  const grandOpening = useMemo(
    () => cols.reduce((s, c) => s + money(opening[c.id]), 0),
    [cols, opening]
  );
  const grandFloor = useMemo(
    () => cols.reduce((s, c) => s + floorAutoFor(c.id), 0),
    [cols, opening, saleRows]
  );
  const grandCompany = useMemo(
    () => cols.reduce((s, c) => s + money(companyIn[c.id]), 0),
    [cols, companyIn]
  );
  const grandClosing = useMemo(
    () => cols.reduce((s, c) => s + closingFor(c.id), 0),
    [cols, opening, saleRows, companyIn]
  );

  async function save(e: FormEvent) {
    e.preventDefault();
    setError("");
    if (!cols.length) {
      setError("Add at least one product column");
      return;
    }
    const items = cols.map((c) => ({
      product_id: c.id,
      opening_stock: money(opening[c.id]),
      floor_stock: floorAutoFor(c.id),
      stock_from_company: money(companyIn[c.id]),
      closing_stock: closingFor(c.id),
    }));
    const sales = saleRows.flatMap((r) =>
      r.salesman_id && rowTotal(r) > 0
        ? cols
            .filter((c) => money(r.qty[c.id]) > 0)
            .map((c) => ({ salesman_id: r.salesman_id, product_id: c.id, qty: money(r.qty[c.id]) }))
        : []
    );
    setSaving(true);
    try {
      const res = await fetch("/api/stockbook", {
        method: editingId ? "PUT" : "POST",
        headers: { "Content-Type": "application/json" },
        body: JSON.stringify({
          ...(editingId ? { id: editingId } : {}),
          ...form,
          items,
          sales,
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
    if (!confirm("Delete this day's stockbook?")) return;
    const res = await fetch(`/api/stockbook?id=${id}`, { method: "DELETE" });
    if (!res.ok) {
      const data = await res.json().catch(() => ({}));
      setError(data.error || "Delete failed");
      return;
    }
    await load();
  }

  function printDay(r: SavedDay) {
    const items = r.items || [];
    const sales = r.sales || [];
    const bySalesman = new Map<number, { name: string; qty: Record<string, number> }>();
    for (const s of sales) {
      const idx = items.findIndex((i) => i.product_id === s.product_id);
      if (idx < 0) continue;
      if (!bySalesman.has(s.salesman_id))
        bySalesman.set(s.salesman_id, { name: s.salesman_name || `Salesman ${s.salesman_id}`, qty: {} });
      bySalesman.get(s.salesman_id)!.qty[String(idx)] = money(s.qty);
    }
    printStockbookBill({
      companyName: company.name,
      companyPhone: company.phone,
      companyAddress: company.address,
      date: r.book_date,
      note: r.note || undefined,
      products: items.map((i) => ({
        name: i.product_name,
        size: i.product_size,
        opening: money(i.opening_stock),
        floor: money(i.floor_stock),
        company: money(i.stock_from_company),
        closing: money(i.closing_stock),
      })),
      salesmen: [...bySalesman.values()],
    });
  }

  const filtered = rows.filter((r) => {
    const itemsText = (r.items || [])
      .map((i) => `${i.product_name} ${i.product_size || ""}`)
      .join(" ");
    return matchSearch(`${r.book_date} ${r.note || ""} ${itemsText}`, q);
  });

  const addableProducts = allProducts.filter((p) => !cols.some((c) => c.id === p.id));

  const cellInput = (value: number, onChange: (v: number) => void, className = "") => (
    <input
      type="number"
      min={0}
      step="any"
      value={value}
      onChange={(e) => onChange(Number(e.target.value))}
      className={`w-20 rounded-lg border border-edge bg-white px-2 py-1.5 text-center text-sm outline-none focus:border-brand-400 focus:ring-2 focus:ring-brand-400/30 ${className}`}
    />
  );

  return (
    <div>
      <PageHeader
        title="Stockbook"
        subtitle="Daily stock sheet"
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
            q
              ? "No stockbook entry found for this search."
              : "No stockbook entries yet. Add today's stock sheet."
          }
        />
      ) : (
        <div className="space-y-4">
          {filtered.map((r) => {
            const items = r.items || [];
            const totalClosing = items.reduce((s, i) => s + money(i.closing_stock), 0);
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
                        {items.length} product{items.length === 1 ? "" : "s"} · Closing: {totalClosing}
                      </p>
                    </div>
                  </div>
                  <div className="flex gap-1">
                    <Button variant="ghost" className="!px-2 !py-1.5" onClick={() => printDay(r)}>
                      <Printer size={15} />
                    </Button>
                    <Button variant="ghost" className="!px-2 !py-1.5" onClick={() => openEdit(r.id)}>
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
                        <th className="px-5 py-2.5 text-xs font-semibold uppercase tracking-wide text-slate-400">
                          Particulars
                        </th>
                        {items.map((i) => (
                          <th key={i.product_id} className="px-2 py-2.5 text-center text-xs font-semibold text-slate-500">
                            {i.product_name} {i.product_size ? `(${i.product_size})` : ""}
                          </th>
                        ))}
                        <th className="px-5 py-2.5 text-center text-xs font-semibold uppercase tracking-wide text-slate-400">
                          Total
                        </th>
                      </tr>
                    </thead>
                    <tbody>
                      <tr className="border-b border-slate-50">
                        <td className="px-5 py-3 font-semibold text-slate-700">Opening Stock</td>
                        {items.map((i) => (
                          <td key={i.product_id} className="px-2 py-3 text-center">
                            {money(i.opening_stock)}
                          </td>
                        ))}
                        <td className="px-5 py-3 text-center font-semibold">
                          {items.reduce((s, i) => s + money(i.opening_stock), 0)}
                        </td>
                      </tr>
                      {[...new Set(r.sales || []).values()]
                        .map((s) => s.salesman_name)
                        .filter((n, i, a) => a.indexOf(n) === i)
                        .map((name, ri) => (
                          <tr key={ri} className="border-b border-slate-50">
                            <td className="px-5 py-3 text-slate-700">{name}</td>
                            {items.map((i) => (
                              <td key={i.product_id} className="px-2 py-3 text-center">
                                {money(
                                  (r.sales || []).find(
                                    (s) => s.salesman_name === name && s.product_id === i.product_id
                                  )?.qty
                                )}
                              </td>
                            ))}
                            <td className="px-5 py-3 text-center">
                              {items.reduce(
                                (s, i) =>
                                  s +
                                  money(
                                    (r.sales || []).find(
                                      (x) =>
                                        x.salesman_name === name && x.product_id === i.product_id
                                    )?.qty
                                  ),
                                0
                              )}
                            </td>
                          </tr>
                        ))}
                      <tr className="border-b border-slate-50 bg-slate-50">
                        <td className="px-5 py-3 font-bold text-slate-800">Total Sale</td>
                        {items.map((i) => (
                          <td key={i.product_id} className="px-2 py-3 text-center font-bold">
                            {money(
                              (r.sales || []).reduce(
                                (s, x) => (x.product_id === i.product_id ? s + money(x.qty) : s),
                                0
                              )
                            )}
                          </td>
                        ))}
                        <td className="px-5 py-3 text-center font-bold">
                          {(r.sales || []).reduce((s, x) => s + money(x.qty), 0)}
                        </td>
                      </tr>
                      <tr className="border-b border-slate-50">
                        <td className="px-5 py-3 font-semibold text-slate-700">Floor Stock</td>
                        {items.map((i) => (
                          <td key={i.product_id} className="px-2 py-3 text-center">
                            {money(i.floor_stock)}
                          </td>
                        ))}
                        <td className="px-5 py-3 text-center font-semibold">
                          {items.reduce((s, i) => s + money(i.floor_stock), 0)}
                        </td>
                      </tr>
                      <tr className="border-b border-slate-50">
                        <td className="px-5 py-3 font-semibold text-slate-700">Stock From Company</td>
                        {items.map((i) => (
                          <td key={i.product_id} className="px-2 py-3 text-center">
                            {money(i.stock_from_company)}
                          </td>
                        ))}
                        <td className="px-5 py-3 text-center font-semibold">
                          {items.reduce((s, i) => s + money(i.stock_from_company), 0)}
                        </td>
                      </tr>
                      <tr className="bg-slate-50">
                        <td className="px-5 py-3 font-bold text-slate-800">Closing Stock</td>
                        {items.map((i) => (
                          <td key={i.product_id} className="px-2 py-3 text-center font-bold">
                            {money(i.closing_stock)}
                          </td>
                        ))}
                        <td className="px-5 py-3 text-center font-bold">{totalClosing}</td>
                      </tr>
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
        title={editingId ? "Edit Stock Sheet" : "New Stock Sheet"}
        wide
      >
        <form onSubmit={save} className="space-y-4">
          <div className="grid gap-3 sm:grid-cols-2">
            <Input
              label="Date *"
              type="date"
              value={form.book_date}
              onChange={(e) => onDateChange(e.target.value)}
            />
            <div className="flex items-end gap-2">
              <Select
                label="Add Product Column"
                value={addProductId || ""}
                onChange={(e) => addColumn(Number(e.target.value))}
              >
                <option value="">Select...</option>
                {addableProducts.map((p) => (
                  <option key={p.id} value={p.id}>
                    {p.name} {p.size || ""}
                  </option>
                ))}
              </Select>
            </div>
          </div>

          <div className="overflow-x-auto rounded-xl border border-slate-200">
            <table className="w-full text-sm">
              <thead>
                <tr className="border-b border-slate-200 bg-slate-50">
                  <th className="px-3 py-2.5 text-left text-xs font-semibold uppercase tracking-wide text-slate-500">
                    Particulars
                  </th>
                  {cols.map((c) => (
                    <th key={c.id} className="px-2 py-2.5 text-center">
                      <span className="flex items-center justify-center gap-1 text-xs font-semibold text-slate-700">
                        {c.name} {c.size ? `(${c.size})` : ""}
                        <button
                          type="button"
                          className="text-slate-400 hover:text-rose-500"
                          onClick={() => removeColumn(c.id)}
                          title="Remove product"
                        >
                          <X size={13} />
                        </button>
                      </span>
                    </th>
                  ))}
                  <th className="px-3 py-2.5 text-center text-xs font-semibold uppercase tracking-wide text-slate-500">
                    Total
                  </th>
                </tr>
              </thead>
              <tbody>
                <tr className="border-b border-slate-100">
                  <td className="px-3 py-2 font-semibold text-slate-700">Opening Stock</td>
                  {cols.map((c) => (
                    <td key={c.id} className="px-2 py-2 text-center">
                      {cellInput(money(opening[c.id]), (v) => setOpening({ ...opening, [c.id]: v }))}
                    </td>
                  ))}
                  <td className="px-3 py-2 text-center font-bold">{grandOpening}</td>
                </tr>

                {saleRows.map((r, idx) => (
                  <tr key={idx} className="border-b border-slate-100">
                    <td className="px-3 py-2">
                      <div className="flex items-center gap-1">
                        <Select
                          value={r.salesman_id || ""}
                          onChange={(e) =>
                            setSaleRows((prev) =>
                              prev.map((x, i) =>
                                i === idx ? { ...x, salesman_id: Number(e.target.value) } : x
                              )
                            )
                          }
                        >
                          <option value="">Salesman...</option>
                          {allSalesmen.map((s) => (
                            <option key={s.id} value={s.id}>
                              {s.name}
                            </option>
                          ))}
                        </Select>
                        <button
                          type="button"
                          className="text-slate-400 hover:text-rose-500"
                          onClick={() => setSaleRows(saleRows.filter((_, i) => i !== idx))}
                          title="Remove row"
                        >
                          <X size={13} />
                        </button>
                      </div>
                    </td>
                    {cols.map((c) => (
                      <td key={c.id} className="px-2 py-2 text-center">
                        {cellInput(money(r.qty[c.id]), (v) => updateSaleQty(idx, c.id, v))}
                      </td>
                    ))}
                    <td className="px-3 py-2 text-center font-bold">{rowTotal(r)}</td>
                  </tr>
                ))}

                <tr className="border-b border-slate-100 bg-brand-50/40">
                  <td className="px-3 py-2 font-bold text-slate-800">Total Sale</td>
                  {cols.map((c) => (
                    <td key={c.id} className="px-2 py-2 text-center font-bold">
                      {totalSaleFor(c.id)}
                    </td>
                  ))}
                  <td className="px-3 py-2 text-center font-bold">{grandTotalSale}</td>
                </tr>

                <tr className="border-b border-slate-100">
                  <td className="px-3 py-2 font-semibold text-slate-700">Floor Stock</td>
                  {cols.map((c) => (
                    <td key={c.id} className="px-2 py-2 text-center font-semibold text-slate-700">
                      {floorAutoFor(c.id)}
                    </td>
                  ))}
                  <td className="px-3 py-2 text-center font-bold">{grandFloor}</td>
                </tr>

                <tr className="border-b border-slate-100">
                  <td className="px-3 py-2 font-semibold text-slate-700">
                    Stock From Company
                  </td>
                  {cols.map((c) => (
                    <td key={c.id} className="px-2 py-2 text-center">
                      {cellInput(
                        money(companyIn[c.id]),
                        (v) => setCompanyIn({ ...companyIn, [c.id]: v })
                      )}
                    </td>
                  ))}
                  <td className="px-3 py-2 text-center font-bold">{grandCompany}</td>
                </tr>

                <tr className="bg-slate-50">
                  <td className="px-3 py-2 font-bold text-slate-800">
                    Closing Stock
                  </td>
                  {cols.map((c) => (
                    <td key={c.id} className="px-2 py-2 text-center font-bold">
                      {closingFor(c.id)}
                    </td>
                  ))}
                  <td className="px-3 py-2 text-center font-bold">{grandClosing}</td>
                </tr>
              </tbody>
            </table>
          </div>

          <div className="flex flex-wrap items-center justify-between gap-2">
            <Button
              type="button"
              variant="secondary"
              className="!py-1.5 !text-xs"
              onClick={() => setSaleRows([...saleRows, emptySalesmanRow()])}
            >
              + Salesman Row
            </Button>
          </div>

          <TextArea
            label="Note"
            value={form.note}
            onChange={(e) => setForm({ ...form, note: e.target.value })}
            placeholder="Daily note"
          />

          {error && <p className="text-sm text-rose-500">{error}</p>}

          <div className="flex justify-end gap-2">
            <Button variant="secondary" type="button" onClick={() => setOpen(false)}>
              Cancel
            </Button>
            <Button type="submit" disabled={saving}>
              {saving ? "Saving..." : "Save Sheet"}
            </Button>
          </div>
        </form>
      </Modal>
    </div>
  );
}
