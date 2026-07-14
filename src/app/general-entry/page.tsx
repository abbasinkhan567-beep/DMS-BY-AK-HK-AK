"use client";

import { FormEvent, useEffect, useState } from "react";
import { Pencil, Plus, Trash2, FileSpreadsheet } from "lucide-react";
import { ACCOUNT_TYPES, formatDate, formatMoney, downloadCsv } from "@/lib/utils";
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

type Account = {
  id: number;
  name: string;
  account_type: string;
  phone: string | null;
  opening_balance: number;
  balance: number;
  notes: string | null;
};

type Entry = {
  id: number;
  entry_date: string;
  account_id: number;
  account_name: string;
  account_type: string;
  entry_type: string;
  amount: number;
  narration: string | null;
  ref_no: string | null;
};

export default function GeneralEntryPage() {
  const [tab, setTab] = useState<"daybook" | "accounts">("daybook");
  const [accounts, setAccounts] = useState<Account[]>([]);
  const [entries, setEntries] = useState<Entry[]>([]);
  const [filterType, setFilterType] = useState("");
  const [q, setQ] = useState("");
  const [openAcc, setOpenAcc] = useState(false);
  const [openEntry, setOpenEntry] = useState(false);
  const [editAcc, setEditAcc] = useState<Account | null>(null);
  const [editEntry, setEditEntry] = useState<Entry | null>(null);
  const [accForm, setAccForm] = useState({
    name: "",
    account_type: "general",
    phone: "",
    opening_balance: 0,
    notes: "",
  });
  const [entryForm, setEntryForm] = useState({
    entry_date: new Date().toISOString().slice(0, 10),
    account_id: 0,
    entry_type: "debit",
    amount: 0,
    narration: "",
    ref_no: "",
  });
  const [saving, setSaving] = useState(false);

  async function load() {
    const qs = filterType ? `?type=${filterType}` : "";
    const [a, e] = await Promise.all([
      fetch(`/api/accounts${qs}`).then((r) => r.json()),
      fetch("/api/general-entries").then((r) => r.json()),
    ]);
    setAccounts(a);
    setEntries(e);
  }

  useEffect(() => {
    load();
    // eslint-disable-next-line react-hooks/exhaustive-deps
  }, [filterType]);

  async function saveAccount(e: FormEvent) {
    e.preventDefault();
    setSaving(true);
    try {
      await fetch("/api/accounts", {
        method: editAcc ? "PUT" : "POST",
        headers: { "Content-Type": "application/json" },
        body: JSON.stringify(editAcc ? { ...accForm, id: editAcc.id } : accForm),
      });
      setOpenAcc(false);
      await load();
    } finally {
      setSaving(false);
    }
  }

  async function saveEntry(e: FormEvent) {
    e.preventDefault();
    setSaving(true);
    try {
      const res = await fetch("/api/general-entries", {
        method: editEntry ? "PUT" : "POST",
        headers: { "Content-Type": "application/json" },
        body: JSON.stringify(editEntry ? { ...entryForm, id: editEntry.id } : entryForm),
      });
      const data = await res.json();
      if (!res.ok) throw new Error(data.error || "Failed");
      setOpenEntry(false);
      await load();
    } catch (err) {
      alert(err instanceof Error ? err.message : "Error");
    } finally {
      setSaving(false);
    }
  }

  return (
    <div>
      <PageHeader
        title="General Entry"
        subtitle="Accounts"
        action={
          <div className="flex gap-2">
            <Button
              variant="secondary"
              onClick={() =>
                downloadCsv(
                  "daybook.csv",
                  entries.map((r) => ({
                    Date: r.entry_date,
                    Account: r.account_name,
                    Type: r.account_type,
                    Entry: r.entry_type,
                    Amount: r.amount,
                    Ref: r.ref_no,
                    Narration: r.narration,
                  }))
                )
              }
            >
              <FileSpreadsheet size={16} /> Excel
            </Button>
            {tab === "accounts" ? (
              <Button
                onClick={() => {
                  setEditAcc(null);
                  setAccForm({
                    name: "",
                    account_type: filterType || "general",
                    phone: "",
                    opening_balance: 0,
                    notes: "",
                  });
                  setOpenAcc(true);
                }}
              >
                <Plus size={16} /> Add Account
              </Button>
            ) : (
              <Button
                onClick={() => {
                  setEditEntry(null);
                  setEntryForm({
                    entry_date: new Date().toISOString().slice(0, 10),
                    account_id: 0,
                    entry_type: "debit",
                    amount: 0,
                    narration: "",
                    ref_no: "",
                  });
                  setOpenEntry(true);
                }}
              >
                <Plus size={16} /> Add Entry
              </Button>
            )}
          </div>
        }
      />

      <div className="mb-4 flex flex-wrap gap-2">
        <button
          type="button"
          onClick={() => setTab("daybook")}
          className={`rounded-xl px-4 py-2.5 text-sm font-semibold ${
            tab === "daybook" ? "bg-brand-600 text-white" : "bg-white text-slate-600 shadow-soft"
          }`}
        >
          Daybook
        </button>
        <button
          type="button"
          onClick={() => setTab("accounts")}
          className={`rounded-xl px-4 py-2.5 text-sm font-semibold ${
            tab === "accounts" ? "bg-brand-600 text-white" : "bg-white text-slate-600 shadow-soft"
          }`}
        >
          Accounts
        </button>
      </div>

      <ModuleSearch
        value={q}
        onChange={setQ}
        placeholder={
          tab === "accounts"
            ? "Search by account name..."
            : "Search by account or narration..."
        }
      />

      {tab === "accounts" && (
        <>
          <div className="mb-4 flex flex-wrap gap-2">
            <button
              type="button"
              onClick={() => setFilterType("")}
              className={`rounded-full px-3 py-1.5 text-xs font-semibold ${
                !filterType ? "bg-brand-600 text-white" : "bg-white text-slate-600 shadow-soft"
              }`}
            >
              All
            </button>
            {ACCOUNT_TYPES.map((t) => (
              <button
                key={t.value}
                type="button"
                onClick={() => setFilterType(t.value)}
                className={`rounded-full px-3 py-1.5 text-xs font-semibold ${
                  filterType === t.value
                    ? "bg-brand-600 text-white"
                    : "bg-white text-slate-600 shadow-soft"
                }`}
              >
                {t.label}
              </button>
            ))}
          </div>

          {accounts.filter((a) => matchSearch(`${a.name} ${a.account_type} ${a.phone || ""}`, q))
            .length === 0 ? (
            <EmptyState message={q ? "No account found for this name." : "No accounts yet."} />
          ) : (
            <Card>
              <div className="overflow-x-auto">
                <table className="w-full min-w-[800px] text-left text-sm">
                  <thead>
                    <tr className="border-b border-slate-100">
                      {["Name", "Type", "Phone", "Opening", "Balance", "Action"].map((h) => (
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
                    {accounts
                      .filter((a) => matchSearch(`${a.name} ${a.account_type} ${a.phone || ""}`, q))
                      .map((a) => (
                      <tr key={a.id} className="border-b border-slate-50">
                        <td className="px-5 py-3.5 font-semibold text-slate-800">{a.name}</td>
                        <td className="px-5 py-3.5 capitalize text-slate-600">{a.account_type}</td>
                        <td className="px-5 py-3.5 text-slate-600">{a.phone || "-"}</td>
                        <td className="px-5 py-3.5">{formatMoney(a.opening_balance)}</td>
                        <td className="px-5 py-3.5 font-semibold">{formatMoney(a.balance)}</td>
                        <td className="px-5 py-3.5">
                          <div className="flex gap-1">
                            <Button
                              variant="ghost"
                              className="!px-2 !py-1.5"
                              onClick={() => {
                                setEditAcc(a);
                                setAccForm({
                                  name: a.name,
                                  account_type: a.account_type,
                                  phone: a.phone || "",
                                  opening_balance: a.opening_balance,
                                  notes: a.notes || "",
                                });
                                setOpenAcc(true);
                              }}
                            >
                              <Pencil size={15} />
                            </Button>
                            <Button
                              variant="ghost"
                              className="!px-2 !py-1.5 text-rose-500"
                              onClick={async () => {
                                if (!confirm("Delete account?")) return;
                                const res = await fetch(`/api/accounts?id=${a.id}`, {
                                  method: "DELETE",
                                });
                                const data = await res.json();
                                if (!res.ok) alert(data.error || "Failed");
                                else await load();
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
        </>
      )}

      {tab === "daybook" &&
        (entries.filter((r) =>
          matchSearch(`${r.account_name} ${r.narration || ""} ${r.ref_no || ""}`, q)
        ).length === 0 ? (
          <EmptyState
            message={q ? "No entry found for this search." : "Daybook is empty. Add an entry first."}
          />
        ) : (
          <Card>
            <div className="overflow-x-auto">
              <table className="w-full min-w-[900px] text-left text-sm">
                <thead>
                  <tr className="border-b border-slate-100">
                    {["Date", "Account", "Type", "Entry", "Amount", "Ref", "Narration", "Action"].map(
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
                  {entries
                    .filter((r) =>
                      matchSearch(`${r.account_name} ${r.narration || ""} ${r.ref_no || ""}`, q)
                    )
                    .map((r) => (
                    <tr key={r.id} className="border-b border-slate-50">
                      <td className="px-5 py-3.5 text-slate-600">{formatDate(r.entry_date)}</td>
                      <td className="px-5 py-3.5 font-semibold text-slate-800">{r.account_name}</td>
                      <td className="px-5 py-3.5 capitalize text-slate-600">{r.account_type}</td>
                      <td className="px-5 py-3.5">
                        <StatusPill tone={r.entry_type === "debit" ? "orange" : "green"}>
                          {r.entry_type}
                        </StatusPill>
                      </td>
                      <td className="px-5 py-3.5 font-semibold">{formatMoney(r.amount)}</td>
                      <td className="px-5 py-3.5 text-slate-600">{r.ref_no || "-"}</td>
                      <td className="px-5 py-3.5 text-slate-500">{r.narration || "-"}</td>
                      <td className="px-5 py-3.5">
                        <div className="flex gap-1">
                          <Button
                            variant="ghost"
                            className="!px-2 !py-1.5"
                            onClick={() => {
                              setEditEntry(r);
                              setEntryForm({
                                entry_date: r.entry_date,
                                account_id: r.account_id,
                                entry_type: r.entry_type,
                                amount: r.amount,
                                narration: r.narration || "",
                                ref_no: r.ref_no || "",
                              });
                              setOpenEntry(true);
                            }}
                          >
                            <Pencil size={15} />
                          </Button>
                          <Button
                            variant="ghost"
                            className="!px-2 !py-1.5 text-rose-500"
                            onClick={async () => {
                              if (!confirm("Delete entry?")) return;
                              await fetch(`/api/general-entries?id=${r.id}`, { method: "DELETE" });
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
        ))}

      <Modal open={openAcc} onClose={() => setOpenAcc(false)} title={editAcc ? "Edit Account" : "Add Account"}>
        <form onSubmit={saveAccount} className="space-y-3">
          <Input
            label="Name"
            required
            value={accForm.name}
            onChange={(e) => setAccForm({ ...accForm, name: e.target.value })}
          />
          <Select
            label="Account Type"
            value={accForm.account_type}
            onChange={(e) => setAccForm({ ...accForm, account_type: e.target.value })}
          >
            {ACCOUNT_TYPES.map((t) => (
              <option key={t.value} value={t.value}>
                {t.label}
              </option>
            ))}
          </Select>
          <div className="grid grid-cols-2 gap-3">
            <Input
              label="Phone"
              value={accForm.phone}
              onChange={(e) => setAccForm({ ...accForm, phone: e.target.value })}
            />
            <Input
              label="Opening Balance"
              type="number"
              value={accForm.opening_balance}
              onChange={(e) => setAccForm({ ...accForm, opening_balance: Number(e.target.value) })}
            />
          </div>
          <TextArea
            label="Notes"
            value={accForm.notes}
            onChange={(e) => setAccForm({ ...accForm, notes: e.target.value })}
          />
          <div className="flex justify-end gap-2">
            <Button variant="secondary" type="button" onClick={() => setOpenAcc(false)}>
              Cancel
            </Button>
            <Button type="submit" disabled={saving}>
              Save
            </Button>
          </div>
        </form>
      </Modal>

      <Modal
        open={openEntry}
        onClose={() => setOpenEntry(false)}
        title={editEntry ? "Edit Entry" : "Add Daybook Entry"}
      >
        <form onSubmit={saveEntry} className="space-y-3">
          <Input
            label="Date"
            type="date"
            value={entryForm.entry_date}
            onChange={(e) => setEntryForm({ ...entryForm, entry_date: e.target.value })}
          />
          <Select
            label="Account"
            value={entryForm.account_id || ""}
            onChange={(e) => setEntryForm({ ...entryForm, account_id: Number(e.target.value) })}
          >
            <option value="">Select...</option>
            {accounts.map((a) => (
              <option key={a.id} value={a.id}>
                {a.name} ({a.account_type})
              </option>
            ))}
          </Select>
          <div className="grid grid-cols-2 gap-3">
            <Select
              label="Debit / Credit"
              value={entryForm.entry_type}
              onChange={(e) => setEntryForm({ ...entryForm, entry_type: e.target.value })}
            >
              <option value="debit">Debit</option>
              <option value="credit">Credit</option>
            </Select>
            <Input
              label="Amount"
              type="number"
              min={0}
              value={entryForm.amount}
              onChange={(e) => setEntryForm({ ...entryForm, amount: Number(e.target.value) })}
            />
          </div>
          <Input
            label="Ref No"
            value={entryForm.ref_no}
            onChange={(e) => setEntryForm({ ...entryForm, ref_no: e.target.value })}
          />
          <TextArea
            label="Narration"
            value={entryForm.narration}
            onChange={(e) => setEntryForm({ ...entryForm, narration: e.target.value })}
          />
          <div className="flex justify-end gap-2">
            <Button variant="secondary" type="button" onClick={() => setOpenEntry(false)}>
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
