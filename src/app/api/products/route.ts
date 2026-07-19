import { NextRequest, NextResponse } from "next/server";
import { getDb } from "@/lib/db";
import { seedIfEmpty } from "@/lib/seed";

export async function GET() {
  seedIfEmpty();
  const db = getDb();
  const products = db
    .prepare("SELECT * FROM products ORDER BY name, size")
    .all();
  return NextResponse.json(products);
}

export async function POST(req: NextRequest) {
  const body = await req.json();
  const {
    name,
    size,
    unit = "bottle",
    purchase_price = 0,
    sale_price = 0,
    stock = 0,
    min_stock = 10,
  } = body;

  if (!name || !size) {
    return NextResponse.json({ error: "Name and size required" }, { status: 400 });
  }

  const db = getDb();
  const result = db
    .prepare(
      `INSERT INTO products (name, size, unit, purchase_price, sale_price, stock, min_stock)
       VALUES (?, ?, ?, ?, ?, ?, ?)`
    )
    .run(name, size, unit, purchase_price, sale_price, stock, min_stock);

  const product = db.prepare("SELECT * FROM products WHERE id = ?").get(result.lastInsertRowid);
  return NextResponse.json(product, { status: 201 });
}

export async function PUT(req: NextRequest) {
  const body = await req.json();
  const { id, name, size, unit, purchase_price, sale_price, stock, min_stock } = body;

  if (!id) {
    return NextResponse.json({ error: "ID required" }, { status: 400 });
  }

  const db = getDb();
  db.prepare(
    `UPDATE products SET name=?, size=?, unit=?, purchase_price=?, sale_price=?, stock=?, min_stock=?
     WHERE id=?`
  ).run(name, size, unit, purchase_price, sale_price, stock, min_stock, id);

  const product = db.prepare("SELECT * FROM products WHERE id = ?").get(id);
  return NextResponse.json(product);
}

export async function DELETE(req: NextRequest) {
  const { searchParams } = new URL(req.url);
  const id = searchParams.get("id");
  if (!id) {
    return NextResponse.json({ error: "ID required" }, { status: 400 });
  }

  const db = getDb();
  const used = db.prepare("SELECT COUNT(*) as c FROM purchase_items WHERE product_id = ?").get(id) as { c: number };
  const sold = db.prepare("SELECT COUNT(*) as c FROM sale_items WHERE product_id = ?").get(id) as { c: number };
  if (used.c > 0 || sold.c > 0) {
    return NextResponse.json(
      { error: "Cannot delete. This product is used in purchases or sales. Remove those entries first." },
      { status: 400 }
    );
  }
  db.prepare("DELETE FROM products WHERE id = ?").run(id);
  return NextResponse.json({ ok: true });
}
