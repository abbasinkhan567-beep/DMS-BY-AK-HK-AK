import { NextRequest, NextResponse } from "next/server";
import { getDb } from "@/lib/db";

export async function GET(req: NextRequest) {
  const db = getDb();
  const date = req.nextUrl.searchParams.get("date");

  if (date) {
    const sales = db
      .prepare(
        `SELECT s.id, s.invoice_no, s.sale_date, s.total_amount, s.paid_amount, s.is_historical,
                c.name as customer_name
         FROM sales s JOIN customers c ON c.id = s.customer_id
         WHERE s.sale_date = ?
         ORDER BY s.id DESC`
      )
      .all(date);
    const purchases = db
      .prepare(
        `SELECT id, invoice_no, purchase_date, supplier, company_name, total_amount, paid_amount, is_historical
         FROM purchases WHERE purchase_date = ? ORDER BY id DESC`
      )
      .all(date);
    const expenses = db
      .prepare(
        `SELECT id, expense_date, category, title, amount, is_historical
         FROM expenses WHERE expense_date = ? ORDER BY id DESC`
      )
      .all(date);
    const paper = db.prepare("SELECT * FROM paper_days WHERE entry_date = ?").get(date) as
      | Record<string, unknown>
      | undefined;

    const salesTotal = (sales as Array<{ total_amount: number }>).reduce(
      (s, r) => s + (r.total_amount || 0),
      0
    );
    const purchaseTotal = (purchases as Array<{ total_amount: number }>).reduce(
      (s, r) => s + (r.total_amount || 0),
      0
    );
    const expenseTotal = (expenses as Array<{ amount: number }>).reduce(
      (s, r) => s + (r.amount || 0),
      0
    );

    return NextResponse.json({
      date,
      paper: paper || null,
      sales,
      purchases,
      expenses,
      summary: {
        sales_count: sales.length,
        purchase_count: purchases.length,
        expense_count: expenses.length,
        sales_total: salesTotal,
        purchase_total: purchaseTotal,
        expense_total: expenseTotal,
      },
    });
  }

  const tracked = db
    .prepare(
      `SELECT * FROM paper_days ORDER BY entry_date DESC LIMIT 60`
    )
    .all();

  const recentDates = db
    .prepare(
      `SELECT d as entry_date, SUM(sales_c) as sales_count, SUM(purchase_c) as purchase_count, SUM(expense_c) as expense_count
       FROM (
         SELECT sale_date as d, COUNT(*) as sales_c, 0 as purchase_c, 0 as expense_c FROM sales GROUP BY sale_date
         UNION ALL
         SELECT purchase_date, 0, COUNT(*), 0 FROM purchases GROUP BY purchase_date
         UNION ALL
         SELECT expense_date, 0, 0, COUNT(*) FROM expenses GROUP BY expense_date
       )
       GROUP BY d
       ORDER BY d DESC
       LIMIT 45`
    )
    .all();

  return NextResponse.json({ tracked, recentDates });
}

export async function POST(req: NextRequest) {
  const body = await req.json();
  const entry_date = String(body.entry_date || "").trim();
  const notes = body.notes != null ? String(body.notes) : null;
  const status = body.status === "done" ? "done" : "in_progress";

  if (!/^\d{4}-\d{2}-\d{2}$/.test(entry_date)) {
    return NextResponse.json({ error: "Valid date required (YYYY-MM-DD)" }, { status: 400 });
  }

  const db = getDb();
  db.prepare(
    `INSERT INTO paper_days (entry_date, notes, status, updated_at)
     VALUES (?, ?, ?, datetime('now','localtime'))
     ON CONFLICT(entry_date) DO UPDATE SET
       notes = COALESCE(excluded.notes, paper_days.notes),
       status = excluded.status,
       updated_at = datetime('now','localtime')`
  ).run(entry_date, notes, status);

  const row = db.prepare("SELECT * FROM paper_days WHERE entry_date = ?").get(entry_date);
  return NextResponse.json({ ok: true, paper: row });
}
