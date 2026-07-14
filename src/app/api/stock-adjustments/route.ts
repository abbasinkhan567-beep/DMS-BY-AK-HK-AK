import { NextRequest, NextResponse } from "next/server";
import { getDb } from "@/lib/db";

export async function GET() {
  const db = getDb();
  const rows = db
    .prepare(
      `SELECT sa.*, p.name as product_name, p.size as product_size
       FROM stock_adjustments sa
       JOIN products p ON p.id = sa.product_id
       ORDER BY sa.id DESC`
    )
    .all();
  return NextResponse.json(rows);
}

export async function POST(req: NextRequest) {
  const body = await req.json();
  const { adjust_date, product_id, new_qty, reason, notes } = body;
  if (!product_id || new_qty === undefined || new_qty === null) {
    return NextResponse.json({ error: "Product and new quantity are required" }, { status: 400 });
  }

  const db = getDb();
  const product = db.prepare("SELECT stock FROM products WHERE id = ?").get(product_id) as
    | { stock: number }
    | undefined;
  if (!product) return NextResponse.json({ error: "Product not found" }, { status: 404 });

  const old_qty = product.stock;
  const difference = Number(new_qty) - old_qty;

  const tx = db.transaction(() => {
    const result = db
      .prepare(
        `INSERT INTO stock_adjustments (adjust_date, product_id, old_qty, new_qty, difference, reason, notes)
         VALUES (?, ?, ?, ?, ?, ?, ?)`
      )
      .run(
        adjust_date || new Date().toISOString().slice(0, 10),
        product_id,
        old_qty,
        new_qty,
        difference,
        reason || null,
        notes || null
      );
    db.prepare("UPDATE products SET stock = ? WHERE id = ?").run(new_qty, product_id);
    return result.lastInsertRowid;
  });

  const id = tx();
  return NextResponse.json(
    db
      .prepare(
        `SELECT sa.*, p.name as product_name, p.size as product_size
         FROM stock_adjustments sa JOIN products p ON p.id = sa.product_id WHERE sa.id = ?`
      )
      .get(id),
    { status: 201 }
  );
}

export async function DELETE(req: NextRequest) {
  const id = new URL(req.url).searchParams.get("id");
  if (!id) return NextResponse.json({ error: "ID required" }, { status: 400 });

  const db = getDb();
  try {
    const tx = db.transaction(() => {
      const row = db.prepare("SELECT * FROM stock_adjustments WHERE id = ?").get(id) as
        | { product_id: number; old_qty: number }
        | undefined;
      if (!row) throw new Error("Not found");
      db.prepare("UPDATE products SET stock = ? WHERE id = ?").run(row.old_qty, row.product_id);
      db.prepare("DELETE FROM stock_adjustments WHERE id = ?").run(id);
    });
    tx();
    return NextResponse.json({ ok: true });
  } catch (e) {
    return NextResponse.json({ error: String(e) }, { status: 400 });
  }
}
