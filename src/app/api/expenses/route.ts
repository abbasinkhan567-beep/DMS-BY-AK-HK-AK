import { NextRequest, NextResponse } from "next/server";
import { getDb } from "@/lib/db";

export async function GET(req: NextRequest) {
  const db = getDb();
  const { searchParams } = new URL(req.url);
  const from = searchParams.get("from");
  const to = searchParams.get("to");

  let sql = "SELECT * FROM expenses WHERE 1=1";
  const params: string[] = [];
  if (from) {
    sql += " AND expense_date >= ?";
    params.push(from);
  }
  if (to) {
    sql += " AND expense_date <= ?";
    params.push(to);
  }
  sql += " ORDER BY id DESC";

  const rows = db.prepare(sql).all(...params);
  return NextResponse.json(rows);
}

export async function POST(req: NextRequest) {
  const body = await req.json();
  const {
    expense_date,
    category = "General",
    title,
    amount = 0,
    paid_from = "Cash",
    salesman_id,
    notes,
    historical = false,
    is_historical = 0,
  } = body;
  if (!title) return NextResponse.json({ error: "Title required" }, { status: 400 });

  const isHistorical = Boolean(historical || is_historical);
  const db = getDb();
  const result = db
    .prepare(
      `INSERT INTO expenses (expense_date, category, title, amount, paid_from, salesman_id, notes, is_historical)
       VALUES (?, ?, ?, ?, ?, ?, ?, ?)`
    )
    .run(
      expense_date || new Date().toISOString().slice(0, 10),
      category,
      title,
      amount,
      paid_from,
      salesman_id || null,
      notes || null,
      isHistorical ? 1 : 0
    );
  const row = db.prepare("SELECT * FROM expenses WHERE id = ?").get(result.lastInsertRowid);
  return NextResponse.json(row, { status: 201 });
}

export async function PUT(req: NextRequest) {
  const body = await req.json();
  const { id, expense_date, category, title, amount, paid_from, salesman_id, notes } = body;
  if (!id) return NextResponse.json({ error: "ID required" }, { status: 400 });
  if (!title) return NextResponse.json({ error: "Title required" }, { status: 400 });

  const db = getDb();
  db.prepare(
    `UPDATE expenses SET expense_date=?, category=?, title=?, amount=?, paid_from=?, salesman_id=?, notes=?
     WHERE id=?`
  ).run(
    expense_date,
    category,
    title,
    amount,
    paid_from,
    salesman_id || null,
    notes || null,
    id
  );
  return NextResponse.json(db.prepare("SELECT * FROM expenses WHERE id = ?").get(id));
}

export async function DELETE(req: NextRequest) {
  const id = new URL(req.url).searchParams.get("id");
  if (!id) return NextResponse.json({ error: "ID required" }, { status: 400 });
  getDb().prepare("DELETE FROM expenses WHERE id = ?").run(id);
  return NextResponse.json({ ok: true });
}
