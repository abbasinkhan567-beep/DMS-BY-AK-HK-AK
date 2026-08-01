import { NextRequest, NextResponse } from "next/server";
import { getDb } from "@/lib/db";
import { getLedgerSubTypeFilter } from "@/lib/ledger-categories";

const VALID_TYPES = ["company", "expense", "customer", "salesman", "floor"];

export async function POST(req: NextRequest) {
  const body = await req.json();
  const { ledger_type, entry_date, ref, party, debit, credit, source, notes, sub_type } = body;

  if (!ledger_type || !VALID_TYPES.includes(ledger_type)) {
    return NextResponse.json({ error: "Invalid ledger_type" }, { status: 400 });
  }

  const db = getDb();

  try {
    const result = db.prepare(
      `INSERT INTO manual_ledger_entries (ledger_type, entry_date, ref, party, debit, credit, source, notes, sub_type)
       VALUES (?, ?, ?, ?, ?, ?, ?, ?, ?)`
    ).run(
      ledger_type,
      entry_date || new Date().toISOString().split("T")[0],
      ref || null,
      party || null,
      Number(debit) || 0,
      Number(credit) || 0,
      source || null,
      notes || null,
      sub_type || null
    );

    const entry = db.prepare("SELECT * FROM manual_ledger_entries WHERE id = ?").get(result.lastInsertRowid);
    return NextResponse.json(entry, { status: 201 });
  } catch (e) {
    return NextResponse.json({ error: String(e) }, { status: 500 });
  }
}

export async function PUT(req: NextRequest) {
  const body = await req.json();
  const { id, ledger_type, entry_date, ref, party, debit, credit, source, notes, sub_type } = body;

  if (!id) return NextResponse.json({ error: "id required" }, { status: 400 });
  if (!ledger_type || !VALID_TYPES.includes(ledger_type)) {
    return NextResponse.json({ error: "Invalid ledger_type" }, { status: 400 });
  }

  const db = getDb();

  try {
    const existing = db.prepare("SELECT id FROM manual_ledger_entries WHERE id = ?").get(id) as
      | { id: number }
      | undefined;
    if (!existing) return NextResponse.json({ error: "Entry not found" }, { status: 404 });

    db.prepare(
      `UPDATE manual_ledger_entries SET ledger_type=?, entry_date=?, ref=?, party=?, debit=?, credit=?, source=?, notes=?, sub_type=?,
       updated_at = datetime('now','localtime')
       WHERE id=?`
    ).run(
      ledger_type,
      entry_date || new Date().toISOString().split("T")[0],
      ref || null,
      party || null,
      Number(debit) || 0,
      Number(credit) || 0,
      source || null,
      notes || null,
      sub_type || null,
      id
    );

    const entry = db.prepare("SELECT * FROM manual_ledger_entries WHERE id = ?").get(id);
    return NextResponse.json(entry);
  } catch (e) {
    return NextResponse.json({ error: String(e) }, { status: 500 });
  }
}

export async function DELETE(req: NextRequest) {
  const { searchParams } = new URL(req.url);
  const id = searchParams.get("id");

  if (!id) {
    return NextResponse.json({ error: "id required" }, { status: 400 });
  }

  const db = getDb();
  try {
    const row = db.prepare("SELECT sync_id FROM manual_ledger_entries WHERE id = ?").get(id) as
      | { sync_id: string }
      | undefined;
    if (!row) return NextResponse.json({ error: "Entry not found" }, { status: 404 });
    if (row.sync_id) {
      db.prepare("INSERT OR IGNORE INTO deleted_records (sync_id) VALUES (?)").run(row.sync_id);
    }
    db.prepare("UPDATE manual_ledger_entries SET deleted = 1 WHERE id = ?").run(id);
    return NextResponse.json({ ok: true });
  } catch (e) {
    return NextResponse.json({ error: String(e) }, { status: 500 });
  }
}