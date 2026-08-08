import { NextRequest, NextResponse } from "next/server";
import { getLedgerRows, LedgerRow } from "@/lib/ledger-rows";

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