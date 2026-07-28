import { NextRequest, NextResponse } from "next/server";
import { getDb } from "@/lib/db";
import { buildExpenseAutoEntries } from "@/lib/accounting";

export async function GET(req: NextRequest) {
  const db = getDb();
  const { searchParams } = new URL(req.url);
  const from = searchParams.get("from");
  const to = searchParams.get("to");

  let sql = "SELECT * FROM expenses WHERE (deleted IS NULL OR deleted = 0)";
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

  const entries = buildExpenseAutoEntries({
    title,
    amount,
    paidFrom: paid_from,
    invoiceNo: `EXP-${result.lastInsertRowid}`,
  });
  for (const entry of entries) {
    const account = db.prepare("SELECT id FROM accounts WHERE name = ?").get(entry.accountName) as { id: number } | undefined;
    if (!account) {
      const insertAccount = db.prepare("INSERT INTO accounts (name, account_type, opening_balance, balance) VALUES (?, 'general', 0, 0)");
      insertAccount.run(entry.accountName);
    }
    const accountId = (db.prepare("SELECT id FROM accounts WHERE name = ?").get(entry.accountName) as { id: number } | undefined)?.id;
    if (accountId) {
      const delta = entry.entryType === "debit" ? entry.amount : -entry.amount;
      db.prepare("UPDATE accounts SET balance = balance + ? WHERE id = ?").run(delta, accountId);
      db.prepare(
        "INSERT INTO general_entries (entry_date, account_id, entry_type, amount, narration, ref_no) VALUES (?, ?, ?, ?, ?, ?)"
      ).run(expense_date || new Date().toISOString().slice(0, 10), accountId, entry.entryType, entry.amount, entry.narration, `EXP-${result.lastInsertRowid}`);
    }
  }

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
  const existing = db.prepare("SELECT id FROM general_entries WHERE ref_no = ?").all(`EXP-${id}`) as Array<{ id: number }>;
  for (const row of existing) {
    db.prepare("UPDATE general_entries SET deleted = 1 WHERE id = ?").run(row.id);
  }
  const entries = buildExpenseAutoEntries({ title, amount, paidFrom: paid_from, invoiceNo: `EXP-${id}` });
  for (const entry of entries) {
    const account = db.prepare("SELECT id FROM accounts WHERE name = ?").get(entry.accountName) as { id: number } | undefined;
    if (!account) {
      const insertAccount = db.prepare("INSERT INTO accounts (name, account_type, opening_balance, balance) VALUES (?, 'general', 0, 0)");
      insertAccount.run(entry.accountName);
    }
    const accountId = (db.prepare("SELECT id FROM accounts WHERE name = ?").get(entry.accountName) as { id: number } | undefined)?.id;
    if (accountId) {
      const delta = entry.entryType === "debit" ? entry.amount : -entry.amount;
      db.prepare("UPDATE accounts SET balance = balance + ? WHERE id = ?").run(delta, accountId);
      db.prepare(
        "INSERT INTO general_entries (entry_date, account_id, entry_type, amount, narration, ref_no) VALUES (?, ?, ?, ?, ?, ?)"
      ).run(expense_date, accountId, entry.entryType, entry.amount, entry.narration, `EXP-${id}`);
    }
  }
  return NextResponse.json(db.prepare("SELECT * FROM expenses WHERE id = ?").get(id));
}

export async function DELETE(req: NextRequest) {
  const id = new URL(req.url).searchParams.get("id");
  if (!id) return NextResponse.json({ error: "ID required" }, { status: 400 });
  const db = getDb();
  const syncId = (db.prepare("SELECT sync_id FROM expenses WHERE id = ?").get(id) as { sync_id: string } | undefined)?.sync_id;
  if (syncId) {
    db.prepare("INSERT OR IGNORE INTO deleted_records (sync_id) VALUES (?)").run(syncId);
  }
  db.prepare("UPDATE expenses SET deleted = 1 WHERE id = ?").run(id);
  return NextResponse.json({ ok: true });
}
