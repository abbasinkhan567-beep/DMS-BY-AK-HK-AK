import { NextRequest, NextResponse } from "next/server";
import { getDb } from "@/lib/db";

export async function GET() {
  const db = getDb();
  const rows = db
    .prepare(
      `SELECT st.*, p.name as product_name, p.size as product_size
       FROM stock_transfers st
       JOIN products p ON p.id = st.product_id
       ORDER BY st.id DESC`
    )
    .all();
  return NextResponse.json(rows);
}

export async function POST(req: NextRequest) {
  const body = await req.json();
  const {
    transfer_date,
    product_id,
    from_location = "main",
    to_location,
    quantity = 0,
    notes,
  } = body;
  if (!product_id || !to_location || quantity <= 0) {
    return NextResponse.json({ error: "Product, destination location and quantity are required" }, { status: 400 });
  }

  const db = getDb();
  const product = db.prepare("SELECT * FROM products WHERE id = ?").get(product_id) as
    | { stock: number; location: string }
    | undefined;
  if (!product) return NextResponse.json({ error: "Product not found" }, { status: 404 });
  if (product.stock < quantity) {
    return NextResponse.json({ error: `Insufficient stock (available: ${product.stock})` }, { status: 400 });
  }

  const tx = db.transaction(() => {
    const result = db
      .prepare(
        `INSERT INTO stock_transfers (transfer_date, product_id, from_location, to_location, quantity, notes)
         VALUES (?, ?, ?, ?, ?, ?)`
      )
      .run(
        transfer_date || new Date().toISOString().slice(0, 10),
        product_id,
        from_location,
        to_location,
        quantity,
        notes || null
      );
    db.prepare("UPDATE products SET location = ? WHERE id = ?").run(to_location, product_id);
    return result.lastInsertRowid;
  });

  const id = tx();
  return NextResponse.json(
    db
      .prepare(
        `SELECT st.*, p.name as product_name, p.size as product_size
         FROM stock_transfers st JOIN products p ON p.id = st.product_id WHERE st.id = ?`
      )
      .get(id),
    { status: 201 }
  );
}

export async function PUT(req: NextRequest) {
  const body = await req.json();
  const { id, transfer_date, from_location, to_location, notes } = body;
  if (!id) return NextResponse.json({ error: "ID required" }, { status: 400 });
  const db = getDb();
  db.prepare(
    `UPDATE stock_transfers SET transfer_date=?, from_location=?, to_location=?, notes=? WHERE id=?`
  ).run(transfer_date, from_location, to_location, notes || null, id);
  return NextResponse.json(
    db
      .prepare(
        `SELECT st.*, p.name as product_name, p.size as product_size
         FROM stock_transfers st JOIN products p ON p.id = st.product_id WHERE st.id = ?`
      )
      .get(id)
  );
}

export async function DELETE(req: NextRequest) {
  const id = new URL(req.url).searchParams.get("id");
  if (!id) return NextResponse.json({ error: "ID required" }, { status: 400 });
  getDb().prepare("DELETE FROM stock_transfers WHERE id = ?").run(id);
  return NextResponse.json({ ok: true });
}
