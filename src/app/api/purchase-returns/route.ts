import { NextRequest, NextResponse } from "next/server";
import { getDb } from "@/lib/db";
import { newSyncId } from "@/lib/sync-ids";
import { todayLocal } from "@/lib/utils";

const num = (v: unknown) => Number(v) || 0;

export async function GET(req: NextRequest) {
  const db = getDb();
  const purchaseId = new URL(req.url).searchParams.get("purchase_id");
  if (!purchaseId) return NextResponse.json({ error: "purchase_id required" }, { status: 400 });
  const rows = db
    .prepare(
      `SELECT pr.*, p.name as product_name, p.size as product_size
       FROM purchase_returns pr
       LEFT JOIN products p ON p.id = pr.product_id
       WHERE pr.purchase_id = ? AND (pr.deleted IS NULL OR pr.deleted = 0)
       ORDER BY pr.id DESC`
    )
    .all(Number(purchaseId));
  return NextResponse.json(rows);
}

export async function POST(req: NextRequest) {
  const body = await req.json();
  const { purchase_id, product_id, qty, return_date, notes } = body;
  if (!purchase_id || !product_id || num(qty) <= 0) {
    return NextResponse.json(
      { error: "purchase, product and qty greater than 0 are required" },
      { status: 400 }
    );
  }

  const db = getDb();
  try {
    const tx = db.transaction(() => {
      const purchase = db
        .prepare("SELECT id FROM purchases WHERE id = ? AND (deleted IS NULL OR deleted = 0)")
        .get(Number(purchase_id)) as { id: number } | undefined;
      if (!purchase) throw new Error("Purchase not found");

      const bought = db
        .prepare(
          `SELECT SUM(COALESCE(quantity, 0)) as qty FROM purchase_items
           WHERE purchase_id = ? AND product_id = ? AND (deleted IS NULL OR deleted = 0)`
        )
        .get(Number(purchase_id), Number(product_id)) as { qty: number };
      const returned = db
        .prepare(
          `SELECT SUM(COALESCE(qty, 0)) as qty FROM purchase_returns
           WHERE purchase_id = ? AND product_id = ? AND (deleted IS NULL OR deleted = 0)`
        )
        .get(Number(purchase_id), Number(product_id)) as { qty: number };
      const maxReturn = num(bought.qty) - num(returned.qty);
      if (maxReturn <= 0 || num(qty) > maxReturn) {
        throw new Error(`Only ${Math.max(0, maxReturn)} more can be returned for this product`);
      }

      const result = db
        .prepare(
          `INSERT INTO purchase_returns (sync_id, updated_at, purchase_id, product_id, qty, return_date, notes)
           VALUES (?, ?, ?, ?, ?, ?, ?)`
        )
        .run(
          newSyncId(),
          new Date().toISOString(),
          Number(purchase_id),
          Number(product_id),
          num(qty),
          return_date || todayLocal(),
          notes || null
        );
      const returnId = Number(result.lastInsertRowid);

      db.prepare(
        "UPDATE products SET stock = MAX(0, COALESCE(stock, 0) - ?) WHERE id = ?"
      ).run(num(qty), Number(product_id));

      return returnId;
    });

    const returnId = tx();
    const row = db
      .prepare(
        `SELECT pr.*, p.name as product_name, p.size as product_size
         FROM purchase_returns pr LEFT JOIN products p ON p.id = pr.product_id
         WHERE pr.id = ?`
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
      const row = db.prepare("SELECT * FROM purchase_returns WHERE id = ?").get(Number(id)) as
        | { sync_id: string; qty: number; product_id: number; deleted: number }
        | undefined;
      if (!row || row.deleted) throw new Error("Return not found");
      if (row.sync_id) {
        db.prepare("INSERT OR IGNORE INTO deleted_records (sync_id) VALUES (?)").run(row.sync_id);
      }
      db.prepare("UPDATE purchase_returns SET deleted = 1 WHERE id = ?").run(Number(id));
      db.prepare("UPDATE products SET stock = COALESCE(stock, 0) + ? WHERE id = ?").run(
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