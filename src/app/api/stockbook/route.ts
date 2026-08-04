import { NextRequest, NextResponse } from "next/server";
import { getDb } from "@/lib/db";
import { newSyncId, stableSyncId } from "@/lib/sync-ids";
import { todayLocal } from "@/lib/utils";

type StockbookItemInput = {
  product_id: number;
  quantity: number;
};

const sbSyncId = (bookDate: string) => stableSyncId(["stockbook", bookDate]);

function itemsFor(db: ReturnType<typeof getDb>, stockbookId: number) {
  return db
    .prepare(
      `SELECT si.*, p.name as product_name, p.size as product_size
       FROM stockbook_items si
       LEFT JOIN products p ON p.id = si.product_id
       WHERE si.stockbook_id = ? AND (si.deleted IS NULL OR si.deleted = 0)
       ORDER BY si.id ASC`
    )
    .all(stockbookId);
}

export async function GET(req: NextRequest) {
  const db = getDb();
  const date = new URL(req.url).searchParams.get("date");
  const id = new URL(req.url).searchParams.get("id");

  if (id) {
    const sb = db
      .prepare("SELECT * FROM stockbook WHERE id = ? AND (deleted IS NULL OR deleted = 0)")
      .get(id) as Record<string, unknown> | undefined;
    if (!sb) return NextResponse.json({ error: "Not found" }, { status: 404 });
    return NextResponse.json({ ...sb, items: itemsFor(db, Number(id)) });
  }

  const rows = (
    date
      ? db
          .prepare(
            `SELECT * FROM stockbook WHERE book_date = ? AND (deleted IS NULL OR deleted = 0)`
          )
          .all(date)
      : db
          .prepare(
            `SELECT * FROM stockbook WHERE (deleted IS NULL OR deleted = 0) ORDER BY book_date DESC`
          )
          .all()
  ) as Array<Record<string, unknown>>;

  return NextResponse.json(
    rows.map((sb) => ({ ...sb, items: itemsFor(db, Number(sb.id)) }))
  );
}

export async function POST(req: NextRequest) {
  const body = await req.json();
  const { book_date, note, items = [] } = body;
  const date = book_date || todayLocal();
  if (!items.length) {
    return NextResponse.json({ error: "At least one product line required" }, { status: 400 });
  }

  const db = getDb();
  const syncId = sbSyncId(date);
  const existing = db
    .prepare("SELECT id FROM stockbook WHERE sync_id = ? AND (deleted IS NULL OR deleted = 0)")
    .get(syncId) as { id: number } | undefined;
  if (existing) {
    return NextResponse.json(
      { error: `Stockbook already exists for ${date} — open that day and edit it instead.` },
      { status: 409 }
    );
  }

  try {
    const tx = db.transaction(() => {
      const result = db
        .prepare(
          `INSERT INTO stockbook (sync_id, updated_at, book_date, note)
           VALUES (?, ?, ?, ?)`
        )
        .run(syncId, new Date().toISOString(), date, note || null);
      const stockbookId = Number(result.lastInsertRowid);

      const insertItem = db.prepare(
        `INSERT INTO stockbook_items (sync_id, updated_at, stockbook_id, product_id, product_name, quantity)
         VALUES (?, ?, ?, ?, ?, ?)`
      );
      for (const item of items as StockbookItemInput[]) {
        const product = db
          .prepare("SELECT name FROM products WHERE id = ?")
          .get(item.product_id) as { name: string } | undefined;
        if (!product) throw new Error("Product not found");
        insertItem.run(
          newSyncId(),
          new Date().toISOString(),
          stockbookId,
          item.product_id,
          product.name,
          item.quantity
        );
      }
      return stockbookId;
    });

    const stockbookId = tx();
    const sb = db
      .prepare("SELECT * FROM stockbook WHERE id = ?")
      .get(stockbookId) as Record<string, unknown>;
    return NextResponse.json({ ...sb, items: itemsFor(db, stockbookId) }, { status: 201 });
  } catch (e) {
    return NextResponse.json({ error: String(e) }, { status: 500 });
  }
}

export async function PUT(req: NextRequest) {
  const body = await req.json();
  const { id, book_date, note, items = [] } = body;
  if (!id) return NextResponse.json({ error: "ID required" }, { status: 400 });
  if (!items.length) {
    return NextResponse.json({ error: "At least one product line required" }, { status: 400 });
  }

  const db = getDb();
  try {
    const tx = db.transaction(() => {
      const sb = db
        .prepare("SELECT * FROM stockbook WHERE id = ?")
        .get(id) as Record<string, unknown> | undefined;
      if (!sb) throw new Error("Stockbook not found");

      const date = book_date || sb.book_date;
      const dup = db
        .prepare(
          `SELECT id FROM stockbook WHERE book_date = ? AND id != ? AND (deleted IS NULL OR deleted = 0)`
        )
        .get(date, id) as { id: number } | undefined;
      if (dup) throw new Error(`Another stockbook already exists for ${date}`);

      const oldItems = db
        .prepare("SELECT sync_id FROM stockbook_items WHERE stockbook_id = ? AND (deleted IS NULL OR deleted = 0)")
        .all(id) as Array<{ sync_id: string }>;
      for (const item of oldItems) {
        if (item.sync_id) {
          db.prepare("INSERT OR IGNORE INTO deleted_records (sync_id) VALUES (?)").run(item.sync_id);
        }
      }
      db.prepare("UPDATE stockbook_items SET deleted = 1 WHERE stockbook_id = ?").run(id);

      db.prepare(
        `UPDATE stockbook SET book_date = ?, note = ?, sync_id = ?, updated_at = ? WHERE id = ?`
      ).run(date, note || null, sbSyncId(date), new Date().toISOString(), id);

      const insertItem = db.prepare(
        `INSERT INTO stockbook_items (sync_id, updated_at, stockbook_id, product_id, product_name, quantity)
         VALUES (?, ?, ?, ?, ?, ?)`
      );
      for (const item of items as StockbookItemInput[]) {
        const product = db
          .prepare("SELECT name FROM products WHERE id = ?")
          .get(item.product_id) as { name: string } | undefined;
        if (!product) throw new Error("Product not found");
        insertItem.run(
          newSyncId(),
          new Date().toISOString(),
          id,
          item.product_id,
          product.name,
          item.quantity
        );
      }
    });
    tx();
    const sb = db.prepare("SELECT * FROM stockbook WHERE id = ?").get(id) as Record<string, unknown>;
    return NextResponse.json({ ...sb, items: itemsFor(db, Number(id)) });
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
      const sb = db.prepare("SELECT sync_id FROM stockbook WHERE id = ?").get(id) as
        | { sync_id: string }
        | undefined;
      if (!sb) throw new Error("Not found");
      if (sb.sync_id) {
        db.prepare("INSERT OR IGNORE INTO deleted_records (sync_id) VALUES (?)").run(sb.sync_id);
      }
      const itemRows = db
        .prepare("SELECT sync_id FROM stockbook_items WHERE stockbook_id = ?")
        .all(id) as Array<{ sync_id: string }>;
      for (const item of itemRows) {
        if (item.sync_id) {
          db.prepare("INSERT OR IGNORE INTO deleted_records (sync_id) VALUES (?)").run(item.sync_id);
        }
      }
      db.prepare("UPDATE stockbook_items SET deleted = 1 WHERE stockbook_id = ?").run(id);
      db.prepare("UPDATE stockbook SET deleted = 1 WHERE id = ?").run(id);
    });
    tx();
    return NextResponse.json({ ok: true });
  } catch (e) {
    return NextResponse.json({ error: String(e) }, { status: 400 });
  }
}
