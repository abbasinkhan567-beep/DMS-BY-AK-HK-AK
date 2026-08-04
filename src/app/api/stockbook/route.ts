import { NextRequest, NextResponse } from "next/server";
import { getDb } from "@/lib/db";
import { newSyncId, stableSyncId } from "@/lib/sync-ids";
import { todayLocal } from "@/lib/utils";

type StockbookItemInput = {
  product_id: number;
  opening_stock?: number;
  floor_stock?: number;
  stock_from_company?: number;
  closing_stock?: number;
};

type StockbookSaleInput = {
  salesman_id: number;
  product_id: number;
  qty: number;
};

const sbSyncId = (bookDate: string) => stableSyncId(["stockbook", bookDate]);
const num = (v: unknown) => Number(v) || 0;

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

function salesFor(db: ReturnType<typeof getDb>, stockbookId: number) {
  return db
    .prepare(
      `SELECT ss.*, s.name as salesman_name
       FROM stockbook_sales ss
       LEFT JOIN salesmen s ON s.id = ss.salesman_id
       WHERE ss.stockbook_id = ? AND (ss.deleted IS NULL OR ss.deleted = 0)
       ORDER BY ss.id ASC`
    )
    .all(stockbookId);
}

export async function GET(req: NextRequest) {
  const db = getDb();
  const date = new URL(req.url).searchParams.get("date");
  const id = new URL(req.url).searchParams.get("id");
  const compute = new URL(req.url).searchParams.get("compute") === "1";

  if (compute && date) {
    const prev = db
      .prepare(
        `SELECT si.product_id,
                COALESCE(si.closing_stock, 0) as closing_stock
         FROM stockbook_items si
         JOIN stockbook sb ON sb.id = si.stockbook_id
         WHERE sb.book_date < ? AND (sb.deleted IS NULL OR sb.deleted = 0)
           AND (si.deleted IS NULL OR si.deleted = 0)
         ORDER BY sb.book_date DESC`
      )
      .all(date) as Array<{ product_id: number; closing_stock: number }>;

    const opening: Record<number, number> = {};
    for (const r of prev) {
      if (!(r.product_id in opening)) opening[r.product_id] = num(r.closing_stock);
    }

    const companyRows = db
      .prepare(
        `SELECT pi.product_id, SUM(COALESCE(pi.quantity, 0)) as qty
         FROM purchase_items pi
         JOIN purchases p ON p.id = pi.purchase_id
         WHERE p.purchase_date = ? AND (p.deleted IS NULL OR p.deleted = 0)
         GROUP BY pi.product_id`
      )
      .all(date) as Array<{ product_id: number; qty: number }>;
    const stock_from_company: Record<number, number> = {};
    for (const r of companyRows) stock_from_company[r.product_id] = num(r.qty);

    const ids = [...new Set([...Object.keys(opening), ...Object.keys(stock_from_company)].map(Number))];
    const products = ids.length
      ? (db
          .prepare(
            `SELECT id, name, size FROM products WHERE id IN (${ids.map(() => "?").join(",")})`
          )
          .all(...ids) as Array<{ id: number; name: string; size: string | null }>)
      : [];

    const salesmen = db
      .prepare(
        `SELECT id, name FROM salesmen WHERE status = 'active' ORDER BY name ASC`
      )
      .all();

    return NextResponse.json({ date, opening, stock_from_company, products, salesmen });
  }

  if (id) {
    const sb = db
      .prepare("SELECT * FROM stockbook WHERE id = ? AND (deleted IS NULL OR deleted = 0)")
      .get(id) as Record<string, unknown> | undefined;
    if (!sb) return NextResponse.json({ error: "Not found" }, { status: 404 });
    return NextResponse.json({
      ...sb,
      items: itemsFor(db, Number(id)),
      sales: salesFor(db, Number(id)),
    });
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
    rows.map((sb) => ({
      ...sb,
      items: itemsFor(db, Number(sb.id)),
      sales: salesFor(db, Number(sb.id)),
    }))
  );
}

export async function POST(req: NextRequest) {
  const body = await req.json();
  const { book_date, note, items = [], sales = [] } = body;
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
      insertLines(db, stockbookId, items, sales);
      return stockbookId;
    });

    const stockbookId = tx();
    const sb = db.prepare("SELECT * FROM stockbook WHERE id = ?").get(stockbookId) as Record<string, unknown>;
    return NextResponse.json(
      { ...sb, items: itemsFor(db, stockbookId), sales: salesFor(db, stockbookId) },
      { status: 201 }
    );
  } catch (e) {
    return NextResponse.json({ error: String(e) }, { status: 500 });
  }
}

export async function PUT(req: NextRequest) {
  const body = await req.json();
  const { id, book_date, note, items = [], sales = [] } = body;
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

      retireRecords(db, id);
      db.prepare("UPDATE stockbook_items SET deleted = 1 WHERE stockbook_id = ?").run(id);
      db.prepare("UPDATE stockbook_sales SET deleted = 1 WHERE stockbook_id = ?").run(id);

      db.prepare(
        `UPDATE stockbook SET book_date = ?, note = ?, sync_id = ?, updated_at = ? WHERE id = ?`
      ).run(date, note || null, sbSyncId(date), new Date().toISOString(), id);

      insertLines(db, id, items, sales);
    });
    tx();
    const sb = db.prepare("SELECT * FROM stockbook WHERE id = ?").get(id) as Record<string, unknown>;
    return NextResponse.json({ ...sb, items: itemsFor(db, Number(id)), sales: salesFor(db, Number(id)) });
  } catch (e) {
    return NextResponse.json({ error: String(e) }, { status: 400 });
  }
}

function retireRecords(db: ReturnType<typeof getDb>, stockbookId: number) {
  const itemSyncs = db
    .prepare("SELECT sync_id FROM stockbook_items WHERE stockbook_id = ? AND (deleted IS NULL OR deleted = 0)")
    .all(stockbookId) as Array<{ sync_id: string }>;
  const saleSyncs = db
    .prepare("SELECT sync_id FROM stockbook_sales WHERE stockbook_id = ? AND (deleted IS NULL OR deleted = 0)")
    .all(stockbookId) as Array<{ sync_id: string }>;
  for (const r of [...itemSyncs, ...saleSyncs]) {
    if (r.sync_id) db.prepare("INSERT OR IGNORE INTO deleted_records (sync_id) VALUES (?)").run(r.sync_id);
  }
}

function insertLines(
  db: ReturnType<typeof getDb>,
  stockbookId: number,
  items: StockbookItemInput[],
  sales: StockbookSaleInput[]
) {
  const productName = db.prepare("SELECT name FROM products WHERE id = ?");
  const insertItem = db.prepare(
    `INSERT INTO stockbook_items (
       sync_id, updated_at, stockbook_id, product_id, product_name,
       opening_stock, floor_stock, stock_from_company, closing_stock
     ) VALUES (?, ?, ?, ?, ?, ?, ?, ?, ?)`
  );
  for (const item of items) {
    const product = productName.get(item.product_id) as { name: string } | undefined;
    if (!product) throw new Error("Product not found");
    insertItem.run(
      newSyncId(),
      new Date().toISOString(),
      stockbookId,
      item.product_id,
      product.name,
      num(item.opening_stock),
      num(item.floor_stock),
      num(item.stock_from_company),
      num(item.closing_stock)
    );
  }

  const insertSale = db.prepare(
    `INSERT INTO stockbook_sales (sync_id, updated_at, stockbook_id, salesman_id, product_id, qty)
     VALUES (?, ?, ?, ?, ?, ?)`
  );
  for (const s of sales) {
    if (!s.salesman_id || !s.product_id || !num(s.qty)) continue;
    insertSale.run(
      newSyncId(),
      new Date().toISOString(),
      stockbookId,
      s.salesman_id,
      s.product_id,
      num(s.qty)
    );
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
      retireRecords(db, Number(id));
      db.prepare("DELETE FROM stockbook_items WHERE stockbook_id = ?").run(id);
      db.prepare("DELETE FROM stockbook_sales WHERE stockbook_id = ?").run(id);
      db.prepare("DELETE FROM stockbook WHERE id = ?").run(id);
    });
    tx();
    return NextResponse.json({ ok: true });
  } catch (e) {
    return NextResponse.json({ error: String(e) }, { status: 400 });
  }
}