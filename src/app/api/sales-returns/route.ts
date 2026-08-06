import { NextRequest, NextResponse } from "next/server";
import { getDb } from "@/lib/db";
import { newSyncId } from "@/lib/sync-ids";
import { todayLocal } from "@/lib/utils";

const num = (v: unknown) => Number(v) || 0;

export async function GET(req: NextRequest) {
  const db = getDb();
  const saleId = new URL(req.url).searchParams.get("sale_id");
  if (!saleId) return NextResponse.json({ error: "sale_id required" }, { status: 400 });
  const rows = db
    .prepare(
      `SELECT sr.*, p.name as product_name, p.size as product_size
       FROM sales_returns sr
       LEFT JOIN products p ON p.id = sr.product_id
       WHERE sr.sale_id = ? AND (sr.deleted IS NULL OR sr.deleted = 0)
       ORDER BY sr.id DESC`
    )
    .all(Number(saleId));
  return NextResponse.json(rows);
}

export async function POST(req: NextRequest) {
  const body = await req.json();
  const { sale_id, product_id, qty, return_date, notes } = body;
  if (!sale_id || !product_id || num(qty) <= 0) {
    return NextResponse.json(
      { error: "sale, product and qty greater than 0 are required" },
      { status: 400 }
    );
  }

  const db = getDb();
  try {
    const tx = db.transaction(() => {
      const sale = db
        .prepare("SELECT id FROM sales WHERE id = ? AND (deleted IS NULL OR deleted = 0)")
        .get(Number(sale_id)) as { id: number } | undefined;
      if (!sale) throw new Error("Sale not found");

      const sold = db
        .prepare(
          `SELECT SUM(COALESCE(quantity, 0)) as qty FROM sale_items
           WHERE sale_id = ? AND product_id = ? AND (deleted IS NULL OR deleted = 0)`
        )
        .get(Number(sale_id), Number(product_id)) as { qty: number };
      const returned = db
        .prepare(
          `SELECT SUM(COALESCE(qty, 0)) as qty FROM sales_returns
           WHERE sale_id = ? AND product_id = ? AND (deleted IS NULL OR deleted = 0)`
        )
        .get(Number(sale_id), Number(product_id)) as { qty: number };
      const maxReturn = num(sold.qty) - num(returned.qty);
      if (maxReturn <= 0 || num(qty) > maxReturn) {
        throw new Error(`Only ${Math.max(0, maxReturn)} more can be returned for this product`);
      }

      const result = db
        .prepare(
          `INSERT INTO sales_returns (sync_id, updated_at, sale_id, product_id, qty, return_date, notes)
           VALUES (?, ?, ?, ?, ?, ?, ?)`
        )
        .run(
          newSyncId(),
          new Date().toISOString(),
          Number(sale_id),
          Number(product_id),
          num(qty),
          return_date || todayLocal(),
          notes || null
        );
      const returnId = Number(result.lastInsertRowid);

      db.prepare(
        "UPDATE products SET stock = COALESCE(stock, 0) + ? WHERE id = ?"
      ).run(num(qty), Number(product_id));

      return returnId;
    });

    const returnId = tx();
    const row = db
      .prepare(
        `SELECT sr.*, p.name as product_name, p.size as product_size
         FROM sales_returns sr LEFT JOIN products p ON p.id = sr.product_id
         WHERE sr.id = ?`
      )
      .get(returnId);
    return NextResponse.json(row, { status: 201 });
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
      const row = db.prepare("SELECT * FROM sales_returns WHERE id = ?").get(Number(id)) as
        | { sync_id: string; qty: number; product_id: number; deleted: number }
        | undefined;
      if (!row || row.deleted) throw new Error("Return not found");
      if (row.sync_id) {
        db.prepare("INSERT OR IGNORE INTO deleted_records (sync_id) VALUES (?)").run(row.sync_id);
      }
      db.prepare("UPDATE sales_returns SET deleted = 1 WHERE id = ?").run(Number(id));
      db.prepare("UPDATE products SET stock = MAX(0, COALESCE(stock, 0) - ?) WHERE id = ?").run(
        num(row.qty),
        row.product_id
      );
    });
    tx();
    return NextResponse.json({ ok: true });
  } catch (e) {
    return NextResponse.json({ error: String(e) }, { status: 400 });
  }
}