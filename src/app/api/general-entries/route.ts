import { NextRequest, NextResponse } from "next/server";
import { getDb } from "@/lib/db";

export async function GET(req: NextRequest) {
  const db = getDb();
  const { searchParams } = new URL(req.url);
  const from = searchParams.get("from");
  const to = searchParams.get("to");
  const account_id = searchParams.get("account_id");

  let sql = `
    SELECT ge.*, a.name as account_name, a.account_type
    FROM general_entries ge
    JOIN accounts a ON a.id = ge.account_id
    WHERE 1=1`;
  const params: Array<string | number> = [];
  if (from) {
    sql += " AND ge.entry_date >= ?";
    params.push(from);
  }
  if (to) {
    sql += " AND ge.entry_date <= ?";
    params.push(to);
  }
  if (account_id) {
    sql += " AND ge.account_id = ?";
    params.push(Number(account_id));
  }
  sql += " ORDER BY ge.entry_date DESC, ge.id DESC";

  return NextResponse.json(db.prepare(sql).all(...params));
}

export async function POST(req: NextRequest) {
  const body = await req.json();
  const { entry_date, account_id, entry_type, amount = 0, narration, ref_no } = body;
  if (!account_id || !entry_type) {
    return NextResponse.json({ error: "Account and type required" }, { status: 400 });
  }
  if (!["debit", "credit"].includes(entry_type)) {
    return NextResponse.json({ error: "Invalid entry type" }, { status: 400 });
  }

  const db = getDb();
  const tx = db.transaction(() => {
    const result = db
      .prepare(
        `INSERT INTO general_entries (entry_date, account_id, entry_type, amount, narration, ref_no)
         VALUES (?, ?, ?, ?, ?, ?)`
      )
      .run(
        entry_date || new Date().toISOString().slice(0, 10),
        account_id,
        entry_type,
        amount,
        narration || null,
        ref_no || null
      );

    const delta = entry_type === "debit" ? amount : -amount;
    db.prepare("UPDATE accounts SET balance = balance + ? WHERE id = ?").run(delta, account_id);
    return result.lastInsertRowid;
  });

  const id = tx();
  const row = db
    .prepare(
      `SELECT ge.*, a.name as account_name, a.account_type
       FROM general_entries ge JOIN accounts a ON a.id = ge.account_id WHERE ge.id = ?`
    )
    .get(id);
  return NextResponse.json(row, { status: 201 });
}

export async function PUT(req: NextRequest) {
  const body = await req.json();
  const { id, entry_date, account_id, entry_type, amount, narration, ref_no } = body;
  if (!id) return NextResponse.json({ error: "ID required" }, { status: 400 });

  const db = getDb();
  try {
    const tx = db.transaction(() => {
      const old = db.prepare("SELECT * FROM general_entries WHERE id = ?").get(id) as
        | { account_id: number; entry_type: string; amount: number }
        | undefined;
      if (!old) throw new Error("Not found");

      const oldDelta = old.entry_type === "debit" ? -old.amount : old.amount;
      db.prepare("UPDATE accounts SET balance = balance + ? WHERE id = ?").run(oldDelta, old.account_id);

      db.prepare(
        `UPDATE general_entries SET entry_date=?, account_id=?, entry_type=?, amount=?, narration=?, ref_no=?
         WHERE id=?`
      ).run(entry_date, account_id, entry_type, amount, narration || null, ref_no || null, id);

      const newDelta = entry_type === "debit" ? amount : -amount;
      db.prepare("UPDATE accounts SET balance = balance + ? WHERE id = ?").run(newDelta, account_id);
    });
    tx();
    return NextResponse.json(
      db
        .prepare(
          `SELECT ge.*, a.name as account_name, a.account_type
           FROM general_entries ge JOIN accounts a ON a.id = ge.account_id WHERE ge.id = ?`
        )
        .get(id)
    );
  } catch (e) {
    return NextResponse.json({ error: String(e) }, { status: 400 });
  }
}

export async function DELETE(req: NextRequest) {
  const id = new URL(req.url).searchParams.get("id");
  if (!id) return NextResponse.json({ error: "ID required" }, { status: 400 });
  const db = getDb();
  try {
    const tx = db.transaction(() => {
      const old = db.prepare("SELECT * FROM general_entries WHERE id = ?").get(id) as
        | { account_id: number; entry_type: string; amount: number }
        | undefined;
      if (!old) throw new Error("Not found");
      const delta = old.entry_type === "debit" ? -old.amount : old.amount;
      db.prepare("UPDATE accounts SET balance = balance + ? WHERE id = ?").run(delta, old.account_id);
      db.prepare("DELETE FROM general_entries WHERE id = ?").run(id);
    });
    tx();
    return NextResponse.json({ ok: true });
  } catch (e) {
    return NextResponse.json({ error: String(e) }, { status: 400 });
  }
}
