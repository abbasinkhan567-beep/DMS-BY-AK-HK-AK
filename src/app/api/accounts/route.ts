import { NextRequest, NextResponse } from "next/server";
import { getDb } from "@/lib/db";

export async function GET(req: NextRequest) {
  const db = getDb();
  const type = new URL(req.url).searchParams.get("type");
  const rows = type
    ? db.prepare("SELECT * FROM accounts WHERE account_type = ? ORDER BY name").all(type)
    : db.prepare("SELECT * FROM accounts ORDER BY account_type, name").all();
  return NextResponse.json(rows);
}

export async function POST(req: NextRequest) {
  const body = await req.json();
  const { name, account_type, phone, opening_balance = 0, notes } = body;
  if (!name || !account_type) {
    return NextResponse.json({ error: "Name and type required" }, { status: 400 });
  }
  const db = getDb();
  const result = db
    .prepare(
      `INSERT INTO accounts (name, account_type, phone, opening_balance, balance, notes)
       VALUES (?, ?, ?, ?, ?, ?)`
    )
    .run(name, account_type, phone || null, opening_balance, opening_balance, notes || null);
  return NextResponse.json(
    db.prepare("SELECT * FROM accounts WHERE id = ?").get(result.lastInsertRowid),
    { status: 201 }
  );
}

export async function PUT(req: NextRequest) {
  const body = await req.json();
  const { id, name, account_type, phone, opening_balance, notes } = body;
  if (!id) return NextResponse.json({ error: "ID required" }, { status: 400 });
  const db = getDb();
  const current = db.prepare("SELECT * FROM accounts WHERE id = ?").get(id) as
    | { opening_balance: number; balance: number }
    | undefined;
  if (!current) return NextResponse.json({ error: "Not found" }, { status: 404 });

  const newOpening = opening_balance !== undefined ? opening_balance : current.opening_balance;
  const delta = newOpening - current.opening_balance;
  db.prepare(
    `UPDATE accounts SET name=?, account_type=?, phone=?, opening_balance=?, balance=balance+?, notes=?
     WHERE id=?`
  ).run(name, account_type, phone || null, newOpening, delta, notes || null, id);

  return NextResponse.json(db.prepare("SELECT * FROM accounts WHERE id = ?").get(id));
}

export async function DELETE(req: NextRequest) {
  const id = new URL(req.url).searchParams.get("id");
  if (!id) return NextResponse.json({ error: "ID required" }, { status: 400 });
  const db = getDb();
  const used = db.prepare("SELECT COUNT(*) as c FROM general_entries WHERE account_id = ?").get(id) as {
    c: number;
  };
  if (used.c > 0) {
    return NextResponse.json({ error: "This account has entries. Delete those entries first." }, { status: 400 });
  }
  db.prepare("DELETE FROM accounts WHERE id = ?").run(id);
  return NextResponse.json({ ok: true });
}
