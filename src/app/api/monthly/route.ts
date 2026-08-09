import { NextRequest, NextResponse } from "next/server";
import { getLedgerRows, LedgerRow, productStockRows } from "@/lib/ledger-rows";
import { getDb } from "@/lib/db";

type Account = {
  name: string;
  opening: number;
  debit: number;
  credit: number;
  closing: number;
  rows: LedgerRow[];
};

function lastDayOfMonth(month: string) {
  const [y, m] = month.split("-").map(Number);
  return new Date(y, m, 0).getDate();
}

export async function GET(req: NextRequest) {
  const now = new Date();
  const defaultMonth = `${now.getFullYear()}-${String(now.getMonth() + 1).padStart(2, "0")}`;
  const month = new URL(req.url).searchParams.get("month") || defaultMonth;
  const type = new URL(req.url).searchParams.get("type") || "customer";
  const subType = new URL(req.url).searchParams.get("sub_type") || type;

  if (!/^\d{4}-\d{2}$/.test(month)) {
    return NextResponse.json({ error: "Invalid month" }, { status: 400 });
  }

  const from = `${month}-01`;
  const to = `${month}-${String(lastDayOfMonth(month)).padStart(2, "0")}`;

  if (type === "product") {
    const db = getDb();
    const products = db
      .prepare("SELECT id, name, size, stock FROM products WHERE (deleted IS NULL OR deleted = 0)")
      .all() as Array<{ id: number; name: string; size: string; stock: number }>;
    const movesMonth = productStockRows(from, to);
    const movesMap = new Map<string, { debit: number; credit: number; rows: LedgerRow[] }>();
    for (const r of movesMonth) {
      let acc = movesMap.get(r.party);
      if (!acc) {
        acc = { debit: 0, credit: 0, rows: [] };
        movesMap.set(r.party, acc);
      }
      acc.debit += Number(r.debit) || 0;
      acc.credit += Number(r.credit) || 0;
      acc.rows.push(r);
    }
    const accounts: Account[] = products
      .map((p) => {
        const name = `${p.name} ${p.size}`.trim();
        const mov = movesMap.get(name);
        const debit = mov?.debit || 0;
        const credit = mov?.credit || 0;
        return {
          name,
          opening: (p.stock || 0) - debit + credit,
          debit,
          credit,
          closing: p.stock || 0,
          rows: mov ? mov.rows.sort((x, y) => (x.date > y.date ? -1 : x.date < y.date ? 1 : Number(y.id) - Number(x.id))) : [],
        };
      })
      .filter((a) => a.debit > 0 || a.credit > 0);

    const t = accounts.reduce(
      (t, a) => ({ opening: t.opening + a.opening, debit: t.debit + a.debit, credit: t.credit + a.credit, closing: t.closing + a.closing }),
      { opening: 0, debit: 0, credit: 0, closing: 0 }
    );
    return NextResponse.json({ month, type, subType, single: false, accounts, totals: t });
  }

  const single = !(type === "customer" || type === "salesman");
  const rowsAll = getLedgerRows(type, subType, null, null);
  const rowsMonth = getLedgerRows(type, subType, from, to);

  const byName = new Map<string, Account>();
  const accounts: Account[] = [];

  function accountFor(name: string): Account {
    let acc = byName.get(name);
    if (!acc) {
      acc = { name, opening: 0, debit: 0, credit: 0, closing: 0, rows: [] };
      byName.set(name, acc);
      accounts.push(acc);
    }
    return acc;
  }

  for (const r of rowsAll) {
    const key = single ? "ALL" : r.party || "—";
    const acc = single ? (accounts[0] || (accounts[0] = accountFor(accountName(type, subType)))) : accountFor(key);
    const prefix = `${month}-`;
    if (r.date && r.date.startsWith(prefix)) continue;
    acc.opening += (Number(r.debit) || 0) - (Number(r.credit) || 0);
  }

  for (const r of rowsMonth) {
    const key = single ? "ALL" : r.party || "—";
    const acc = single ? (accounts[0] || (accounts[0] = accountFor(accountName(type, subType)))) : accountFor(key);
    acc.debit += Number(r.debit) || 0;
    acc.credit += Number(r.credit) || 0;
    acc.rows.push(r);
  }

  let tOpening = 0, tDebit = 0, tCredit = 0, tClosing = 0;
  for (const a of accounts) {
    a.closing = a.opening + a.debit - a.credit;
    tOpening += a.opening;
    tDebit += a.debit;
    tCredit += a.credit;
    tClosing += a.closing;
    a.rows.sort((x, y) => (x.date > y.date ? -1 : x.date < y.date ? 1 : Number(y.id) - Number(x.id)));
  }

  accounts.sort((a, b) => b.closing - a.closing || b.debit - a.debit);

  return NextResponse.json({
    month,
    type,
    subType,
    single: single,
    accounts,
    totals: { opening: tOpening, debit: tDebit, credit: tCredit, closing: tClosing },
  });
}

function accountName(type: string, subType: string) {
  switch (type) {
    case "company":
      return subType === "company-conditional"
        ? "Company - Conditional"
        : subType === "company-hand"
          ? "Company - Hand to Hand"
          : subType === "company-paid"
            ? "Company - Paid"
            : "Company";
    case "expense":
      return "Expenses";
    case "floor":
      return "Floor Stock";
    default:
      return type;
  }
}