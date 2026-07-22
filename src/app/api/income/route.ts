import { NextResponse } from "next/server";
import { getDb } from "@/lib/db";

function periodBounds() {
  const now = new Date();
  const y = now.getFullYear();
  const m = String(now.getMonth() + 1).padStart(2, "0");
  const d = String(now.getDate()).padStart(2, "0");
  const today = `${y}-${m}-${d}`;
  const monthStart = `${y}-${m}-01`;
  const yearStart = `${y}-01-01`;
  return { today, monthStart, yearStart, year: y, month: `${y}-${m}` };
}

function sumBetween(
  db: ReturnType<typeof getDb>,
  sqlOneDay: string,
  sqlRange: string,
  from: string,
  to?: string
) {
  if (to) return db.prepare(sqlRange).get(from, to) as Record<string, number>;
  return db.prepare(sqlOneDay).get(from) as Record<string, number>;
}

function buildPeriod(db: ReturnType<typeof getDb>, from: string, to?: string) {
  const sales = sumBetween(
    db,
    `SELECT COALESCE(SUM(total_amount), 0) as income,
            COALESCE(SUM(paid_amount), 0) as received,
            COALESCE(SUM(bill_bakaya), 0) as pending,
            COALESCE(SUM(total_commission), 0) as commission,
            COALESCE(SUM(total_discount), 0) as discount,
            COALESCE(SUM(total_bill_expense), 0) as bill_expense,
            COUNT(*) as bills
     FROM sales WHERE sale_date = ?`,
    `SELECT COALESCE(SUM(total_amount), 0) as income,
            COALESCE(SUM(paid_amount), 0) as received,
            COALESCE(SUM(bill_bakaya), 0) as pending,
            COALESCE(SUM(total_commission), 0) as commission,
            COALESCE(SUM(total_discount), 0) as discount,
            COALESCE(SUM(total_bill_expense), 0) as bill_expense,
            COUNT(*) as bills
     FROM sales WHERE sale_date >= ? AND sale_date <= ?`,
    from,
    to
  );

  const manualExp = sumBetween(
    db,
    `SELECT COALESCE(SUM(amount), 0) as v, COUNT(*) as c FROM expenses WHERE expense_date = ?`,
    `SELECT COALESCE(SUM(amount), 0) as v, COUNT(*) as c FROM expenses WHERE expense_date >= ? AND expense_date <= ?`,
    from,
    to
  );

  const purchaseExp = sumBetween(
    db,
    `SELECT COALESCE(SUM(total_expense), 0) as v, COALESCE(SUM(total_amount), 0) as purchase
     FROM purchases WHERE purchase_date = ?`,
    `SELECT COALESCE(SUM(total_expense), 0) as v, COALESCE(SUM(total_amount), 0) as purchase
     FROM purchases WHERE purchase_date >= ? AND purchase_date <= ?`,
    from,
    to
  );

  const income = Number(sales.income) || 0;
  const discount = Number(sales.discount) || 0;
  const bill_expense = Number(sales.bill_expense) || 0;
  const commission = Number(sales.commission) || 0;
  const manual_expense = Number(manualExp.v) || 0;
  const purchase_expense = Number(purchaseExp.v) || 0;

  const purchase_total = Number(purchaseExp.purchase) || 0;

  const expense = manual_expense + discount + bill_expense + commission;
  const total_expense = expense + purchase_total;

  return {
    income,
    received: Number(sales.received) || 0,
    pending: Number(sales.pending) || 0,
    commission,
    discount,
    bill_expense,
    purchase_expense,
    manual_expense,
    bills: Number(sales.bills) || 0,
    expense,
    expense_count: Number(manualExp.c) || 0,
    purchase: purchase_total,
    net_income: income - expense,
    net_after_purchase: income - total_expense,
  };
}

export async function GET() {
  const db = getDb();
  const { today, monthStart, yearStart, year, month } = periodBounds();

  return NextResponse.json({
    today,
    month,
    year,
    daily: buildPeriod(db, today),
    monthly: buildPeriod(db, monthStart, today),
    yearly: buildPeriod(db, yearStart, today),
  });
}
