import { NextRequest, NextResponse } from "next/server";
import { getDb } from "@/lib/db";

const VALID_TYPES = ["company", "expense", "customer", "salesman", "floor"];

export async function POST(req: NextRequest) {
  const body = await req.json();
  const { ledger_type, entry_date, ref, party, debit, credit, source, notes } = body;

  if (!ledger_type || !VALID_TYPES.includes(ledger_type)) {
    return NextResponse.json({ error: "Invalid ledger_type" }, { status: 400 });
  }

  const db = getDb();

  try {
    const result = db.prepare(
      `INSERT INTO manual_ledger_entries (ledger_type, entry_date, ref, party, debit, credit, source, notes)
       VALUES (?, ?, ?, ?, ?, ?, ?, ?)`
    ).run(
      ledger_type,
      entry_date || new Date().toISOString().split("T")[0],
      ref || null,
      party || null,
      Number(debit) || 0,
      Number(credit) || 0,
      source || null,
      notes || null
    );

    const entry = db.prepare("SELECT * FROM manual_ledger_entries WHERE id = ?").get(result.lastInsertRowid);
    return NextResponse.json(entry, { status: 201 });
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
    db.prepare("DELETE FROM manual_ledger_entries WHERE id = ?").run(id);
    return NextResponse.json({ ok: true });
  } catch (e) {
    return NextResponse.json({ error: String(e) }, { status: 500 });
  }
}