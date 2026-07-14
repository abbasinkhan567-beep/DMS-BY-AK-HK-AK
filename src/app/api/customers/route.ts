import { NextRequest, NextResponse } from "next/server";
import { getDb } from "@/lib/db";

export async function GET() {
  const db = getDb();
  const customers = db
    .prepare("SELECT * FROM customers ORDER BY name")
    .all();
  return NextResponse.json(customers);
}

export async function POST(req: NextRequest) {
  const body = await req.json();
  const { name, shop_name, phone, address, area, balance = 0, notes } = body;

  if (!name) {
    return NextResponse.json({ error: "Name required" }, { status: 400 });
  }

  const db = getDb();
  const result = db
    .prepare(
      `INSERT INTO customers (name, shop_name, phone, address, area, balance, notes)
       VALUES (?, ?, ?, ?, ?, ?, ?)`
    )
    .run(name, shop_name || null, phone || null, address || null, area || null, balance, notes || null);

  const customer = db.prepare("SELECT * FROM customers WHERE id = ?").get(result.lastInsertRowid);
  return NextResponse.json(customer, { status: 201 });
}

export async function PUT(req: NextRequest) {
  const body = await req.json();
  const { id, name, shop_name, phone, address, area, balance, notes } = body;

  if (!id) {
    return NextResponse.json({ error: "ID required" }, { status: 400 });
  }

  const db = getDb();
  db.prepare(
    `UPDATE customers SET name=?, shop_name=?, phone=?, address=?, area=?, balance=?, notes=?
     WHERE id=?`
  ).run(name, shop_name || null, phone || null, address || null, area || null, balance || 0, notes || null, id);

  const customer = db.prepare("SELECT * FROM customers WHERE id = ?").get(id);
  return NextResponse.json(customer);
}

export async function DELETE(req: NextRequest) {
  const { searchParams } = new URL(req.url);
  const id = searchParams.get("id");
  if (!id) {
    return NextResponse.json({ error: "ID required" }, { status: 400 });
  }

  const db = getDb();
  db.prepare("DELETE FROM customers WHERE id = ?").run(id);
  return NextResponse.json({ ok: true });
}
