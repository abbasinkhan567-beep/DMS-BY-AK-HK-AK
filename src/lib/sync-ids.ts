import type Database from "better-sqlite3";
import crypto from "crypto";

const SYNC_TABLES = [
  "products",
  "customers",
  "salesmen",
  "purchases",
  "purchase_items",
  "sales",
  "sale_items",
  "expenses",
  "accounts",
  "general_entries",
  "stock_transfers",
  "stock_adjustments",
  "floors",
  "paper_days",
  "company_info",
] as const;

function tableExists(db: Database.Database, table: string) {
  const row = db
    .prepare("SELECT name FROM sqlite_master WHERE type='table' AND name=?")
    .get(table) as { name: string } | undefined;
  return Boolean(row);
}

function columnExists(db: Database.Database, table: string, column: string) {
  if (!tableExists(db, table)) return false;
  const cols = db.prepare(`PRAGMA table_info(${table})`).all() as Array<{ name: string }>;
  return cols.some((c) => c.name === column);
}

function addColumn(db: Database.Database, table: string, column: string, def: string) {
  if (!tableExists(db, table)) return;
  if (!columnExists(db, table, column)) {
    db.exec(`ALTER TABLE ${table} ADD COLUMN ${column} ${def}`);
  }
}

export function newSyncId() {
  return crypto.randomBytes(16).toString("hex");
}

export function stableSyncId(parts: string[]) {
  return crypto.createHash("sha256").update(parts.join("|")).digest("hex").slice(0, 32);
}

function deviceSeed(db: Database.Database) {
  const row = db.prepare("SELECT value FROM app_settings WHERE key = 'device_id'").get() as
    | { value: string }
    | undefined;
  if (row?.value) return row.value;
  const id = crypto.randomBytes(8).toString("hex");
  db.prepare(
    `INSERT INTO app_settings (key, value) VALUES ('device_id', ?)
     ON CONFLICT(key) DO UPDATE SET value = excluded.value`
  ).run(id);
  return id;
}

/** Add sync_id / updated_at and backfill so merge works across PCs. */
export function ensureSyncSchema(db: Database.Database) {
  for (const table of SYNC_TABLES) {
    addColumn(db, table, "sync_id", "TEXT");
    addColumn(db, table, "updated_at", "TEXT");
  }

  for (const table of SYNC_TABLES) {
    if (!tableExists(db, table)) continue;
    try {
      db.exec(
        `CREATE UNIQUE INDEX IF NOT EXISTS idx_${table}_sync_id ON ${table}(sync_id) WHERE sync_id IS NOT NULL AND sync_id != ''`
      );
    } catch {
      /* duplicates — backfill uses deterministic ids; ignore index failures */
    }
  }

  backfillSyncIds(db);
}

function touchUpdated(db: Database.Database, table: string) {
  if (!tableExists(db, table) || !columnExists(db, table, "updated_at")) return;
  db.prepare(
    `UPDATE ${table} SET updated_at = COALESCE(updated_at, created_at, datetime('now','localtime'))
     WHERE updated_at IS NULL OR updated_at = ''`
  ).run();
}

function backfillSyncIds(db: Database.Database) {
  const seed = deviceSeed(db);

  if (tableExists(db, "products")) {
    const rows = db
      .prepare(
        `SELECT id, name, size, COALESCE(location,'main') as location FROM products
         WHERE sync_id IS NULL OR sync_id = ''`
      )
      .all() as Array<{ id: number; name: string; size: string; location: string }>;
    const upd = db.prepare("UPDATE products SET sync_id = ?, updated_at = COALESCE(updated_at, created_at, datetime('now','localtime')) WHERE id = ?");
    for (const r of rows) {
      try {
        upd.run(stableSyncId(["product", r.name.trim().toLowerCase(), r.size.trim().toLowerCase(), r.location]), r.id);
      } catch {
        upd.run(stableSyncId(["product", r.name.trim().toLowerCase(), r.size.trim().toLowerCase(), r.location, String(r.id)]), r.id);
      }
    }
  }

  if (tableExists(db, "customers")) {
    const rows = db
      .prepare(
        `SELECT id, name, COALESCE(phone,'') as phone, COALESCE(shop_name,'') as shop_name FROM customers
         WHERE sync_id IS NULL OR sync_id = ''`
      )
      .all() as Array<{ id: number; name: string; phone: string; shop_name: string }>;
    const upd = db.prepare("UPDATE customers SET sync_id = ?, updated_at = COALESCE(updated_at, created_at, datetime('now','localtime')) WHERE id = ?");
    for (const r of rows) {
      upd.run(
        stableSyncId(["customer", r.name.trim().toLowerCase(), r.phone.trim(), r.shop_name.trim().toLowerCase()]),
        r.id
      );
    }
  }

  if (tableExists(db, "salesmen")) {
    const rows = db
      .prepare(
        `SELECT id, name, COALESCE(phone,'') as phone FROM salesmen WHERE sync_id IS NULL OR sync_id = ''`
      )
      .all() as Array<{ id: number; name: string; phone: string }>;
    const upd = db.prepare("UPDATE salesmen SET sync_id = ?, updated_at = COALESCE(updated_at, created_at, datetime('now','localtime')) WHERE id = ?");
    for (const r of rows) {
      upd.run(stableSyncId(["salesman", r.name.trim().toLowerCase(), r.phone.trim()]), r.id);
    }
  }

  if (tableExists(db, "floors")) {
    const rows = db
      .prepare(`SELECT id, name FROM floors WHERE sync_id IS NULL OR sync_id = ''`)
      .all() as Array<{ id: number; name: string }>;
    const upd = db.prepare("UPDATE floors SET sync_id = ?, updated_at = COALESCE(updated_at, created_at, datetime('now','localtime')) WHERE id = ?");
    for (const r of rows) {
      upd.run(stableSyncId(["floor", r.name.trim().toLowerCase()]), r.id);
    }
  }

  if (tableExists(db, "accounts")) {
    const rows = db
      .prepare(
        `SELECT id, name, account_type FROM accounts WHERE sync_id IS NULL OR sync_id = ''`
      )
      .all() as Array<{ id: number; name: string; account_type: string }>;
    const upd = db.prepare("UPDATE accounts SET sync_id = ?, updated_at = COALESCE(updated_at, created_at, datetime('now','localtime')) WHERE id = ?");
    for (const r of rows) {
      upd.run(stableSyncId(["account", r.name.trim().toLowerCase(), r.account_type]), r.id);
    }
  }

  if (tableExists(db, "paper_days")) {
    const rows = db
      .prepare(`SELECT id, entry_date FROM paper_days WHERE sync_id IS NULL OR sync_id = ''`)
      .all() as Array<{ id: number; entry_date: string }>;
    const upd = db.prepare("UPDATE paper_days SET sync_id = ?, updated_at = COALESCE(updated_at, created_at, datetime('now','localtime')) WHERE id = ?");
    for (const r of rows) {
      upd.run(stableSyncId(["paper", r.entry_date]), r.id);
    }
  }

  if (tableExists(db, "company_info")) {
    db.prepare(
      `UPDATE company_info SET sync_id = COALESCE(NULLIF(sync_id,''), 'company-1'),
       updated_at = COALESCE(updated_at, datetime('now','localtime')) WHERE id = 1`
    ).run();
  }

  const txTables: Array<{ table: string; created?: boolean }> = [
    { table: "purchases", created: true },
    { table: "sales", created: true },
    { table: "expenses", created: true },
    { table: "general_entries", created: true },
    { table: "stock_transfers", created: true },
    { table: "stock_adjustments", created: true },
  ];

  for (const { table } of txTables) {
    if (!tableExists(db, table)) continue;
    const rows = db
      .prepare(`SELECT id FROM ${table} WHERE sync_id IS NULL OR sync_id = ''`)
      .all() as Array<{ id: number }>;
    const upd = db.prepare(
      `UPDATE ${table} SET sync_id = ?, updated_at = COALESCE(updated_at, created_at, datetime('now','localtime')) WHERE id = ?`
    );
    for (const r of rows) {
      upd.run(`${seed}-${table}-${r.id}`, r.id);
    }
  }

  if (tableExists(db, "purchase_items")) {
    const rows = db
      .prepare(
        `SELECT pi.id, p.sync_id as parent_sync, pi.product_id, pi.quantity
         FROM purchase_items pi JOIN purchases p ON p.id = pi.purchase_id
         WHERE pi.sync_id IS NULL OR pi.sync_id = ''`
      )
      .all() as Array<{ id: number; parent_sync: string; product_id: number; quantity: number }>;
    const upd = db.prepare(
      `UPDATE purchase_items SET sync_id = ?, updated_at = COALESCE(updated_at, datetime('now','localtime')) WHERE id = ?`
    );
    for (const r of rows) {
      upd.run(stableSyncId(["pitem", r.parent_sync || String(r.id), String(r.product_id), String(r.quantity), String(r.id)]), r.id);
    }
  }

  if (tableExists(db, "sale_items")) {
    const rows = db
      .prepare(
        `SELECT si.id, s.sync_id as parent_sync, si.product_id, si.quantity
         FROM sale_items si JOIN sales s ON s.id = si.sale_id
         WHERE si.sync_id IS NULL OR si.sync_id = ''`
      )
      .all() as Array<{ id: number; parent_sync: string; product_id: number; quantity: number }>;
    const upd = db.prepare(
      `UPDATE sale_items SET sync_id = ?, updated_at = COALESCE(updated_at, datetime('now','localtime')) WHERE id = ?`
    );
    for (const r of rows) {
      upd.run(stableSyncId(["sitem", r.parent_sync || String(r.id), String(r.product_id), String(r.quantity), String(r.id)]), r.id);
    }
  }

  for (const table of SYNC_TABLES) {
    touchUpdated(db, table);
  }
}

export function productMovementNet(db: Database.Database, productId: number): number {
  const purch = (
    db
      .prepare(
        `SELECT COALESCE(SUM(pi.quantity), 0) as q
         FROM purchase_items pi
         JOIN purchases p ON p.id = pi.purchase_id
         WHERE pi.product_id = ? AND COALESCE(p.is_historical, 0) = 0`
      )
      .get(productId) as { q: number }
  ).q;

  const sold = (
    db
      .prepare(
        `SELECT COALESCE(SUM(si.quantity), 0) as q
         FROM sale_items si
         JOIN sales s ON s.id = si.sale_id
         WHERE si.product_id = ? AND COALESCE(s.is_historical, 0) = 0`
      )
      .get(productId) as { q: number }
  ).q;

  const adj = (
    db
      .prepare(
        `SELECT COALESCE(SUM(difference), 0) as q FROM stock_adjustments WHERE product_id = ?`
      )
      .get(productId) as { q: number }
  ).q;

  return Number(purch) - Number(sold) + Number(adj);
}

export function recalculateStockAndBalances(db: Database.Database) {
  const products = db.prepare("SELECT id, stock FROM products").all() as Array<{
    id: number;
    stock: number;
  }>;
  const openings = new Map<number, number>();
  for (const p of products) {
    openings.set(p.id, Number(p.stock) - productMovementNet(db, p.id));
  }

  for (const p of products) {
    const opening = openings.get(p.id) ?? 0;
    const stock = opening + productMovementNet(db, p.id);
    db.prepare(
      `UPDATE products SET stock = ?, updated_at = datetime('now','localtime') WHERE id = ?`
    ).run(stock, p.id);
  }

  const customers = db.prepare("SELECT id FROM customers").all() as Array<{ id: number }>;
  for (const c of customers) {
    const bal = (
      db
        .prepare(
          `SELECT COALESCE(SUM(bill_bakaya), 0) as b FROM sales WHERE customer_id = ?`
        )
        .get(c.id) as { b: number }
    ).b;
    db.prepare("UPDATE customers SET balance = ? WHERE id = ?").run(bal, c.id);
  }

  const accounts = db.prepare("SELECT id, opening_balance FROM accounts").all() as Array<{
    id: number;
    opening_balance: number;
  }>;
  for (const a of accounts) {
    const delta = (
      db
        .prepare(
          `SELECT COALESCE(SUM(CASE WHEN entry_type = 'debit' THEN amount ELSE -amount END), 0) as d
           FROM general_entries WHERE account_id = ?`
        )
        .get(a.id) as { d: number }
    ).d;
    db.prepare("UPDATE accounts SET balance = ? WHERE id = ?").run(
      Number(a.opening_balance) + Number(delta),
      a.id
    );
  }
}
