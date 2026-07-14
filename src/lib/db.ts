import Database from "better-sqlite3";
import fs from "fs";
import path from "path";
import crypto from "crypto";
import { ensureSyncSchema } from "@/lib/sync-ids";

const dataDir = path.join(process.cwd(), "data");
if (!fs.existsSync(dataDir)) {
  fs.mkdirSync(dataDir, { recursive: true });
}

export const dbPath = path.join(dataDir, "pepsi.db");

const globalForDb = globalThis as unknown as { __pepsiDb?: Database.Database };

function columnExists(db: Database.Database, table: string, column: string) {
  const cols = db.prepare(`PRAGMA table_info(${table})`).all() as Array<{ name: string }>;
  return cols.some((c) => c.name === column);
}

function addColumn(db: Database.Database, table: string, column: string, def: string) {
  if (!columnExists(db, table, column)) {
    db.exec(`ALTER TABLE ${table} ADD COLUMN ${column} ${def}`);
  }
}

function ensureSchema(db: Database.Database) {
  db.exec(`
    CREATE TABLE IF NOT EXISTS products (
      id INTEGER PRIMARY KEY AUTOINCREMENT,
      name TEXT NOT NULL,
      size TEXT NOT NULL,
      unit TEXT NOT NULL DEFAULT 'crate',
      purchase_price REAL NOT NULL DEFAULT 0,
      sale_price REAL NOT NULL DEFAULT 0,
      stock INTEGER NOT NULL DEFAULT 0,
      min_stock INTEGER NOT NULL DEFAULT 5,
      location TEXT NOT NULL DEFAULT 'main',
      created_at TEXT NOT NULL DEFAULT (datetime('now','localtime'))
    );

    CREATE TABLE IF NOT EXISTS customers (
      id INTEGER PRIMARY KEY AUTOINCREMENT,
      name TEXT NOT NULL,
      shop_name TEXT,
      phone TEXT,
      address TEXT,
      area TEXT,
      balance REAL NOT NULL DEFAULT 0,
      notes TEXT,
      created_at TEXT NOT NULL DEFAULT (datetime('now','localtime'))
    );

    CREATE TABLE IF NOT EXISTS salesmen (
      id INTEGER PRIMARY KEY AUTOINCREMENT,
      name TEXT NOT NULL,
      phone TEXT,
      area TEXT,
      salary REAL NOT NULL DEFAULT 0,
      status TEXT NOT NULL DEFAULT 'active',
      created_at TEXT NOT NULL DEFAULT (datetime('now','localtime'))
    );

    CREATE TABLE IF NOT EXISTS purchases (
      id INTEGER PRIMARY KEY AUTOINCREMENT,
      invoice_no TEXT,
      supplier TEXT NOT NULL DEFAULT 'Pepsi Company',
      company_name TEXT,
      purchase_date TEXT NOT NULL DEFAULT (date('now','localtime')),
      total_amount REAL NOT NULL DEFAULT 0,
      paid_amount REAL NOT NULL DEFAULT 0,
      notes TEXT,
      created_at TEXT NOT NULL DEFAULT (datetime('now','localtime'))
    );

    CREATE TABLE IF NOT EXISTS purchase_items (
      id INTEGER PRIMARY KEY AUTOINCREMENT,
      purchase_id INTEGER NOT NULL REFERENCES purchases(id) ON DELETE CASCADE,
      product_id INTEGER NOT NULL REFERENCES products(id),
      product_name TEXT,
      company_name TEXT,
      size TEXT,
      quantity REAL NOT NULL DEFAULT 0,
      hand_to_hand REAL NOT NULL DEFAULT 0,
      conditional REAL NOT NULL DEFAULT 0,
      rate_per_cotton REAL NOT NULL DEFAULT 0,
      unit_price REAL NOT NULL DEFAULT 0,
      total_rate REAL NOT NULL DEFAULT 0,
      total REAL NOT NULL DEFAULT 0
    );

    CREATE TABLE IF NOT EXISTS sales (
      id INTEGER PRIMARY KEY AUTOINCREMENT,
      invoice_no TEXT,
      customer_id INTEGER NOT NULL REFERENCES customers(id),
      salesman_id INTEGER REFERENCES salesmen(id),
      sale_date TEXT NOT NULL DEFAULT (date('now','localtime')),
      total_amount REAL NOT NULL DEFAULT 0,
      paid_amount REAL NOT NULL DEFAULT 0,
      payment_type TEXT NOT NULL DEFAULT 'cash',
      bill_bakaya REAL NOT NULL DEFAULT 0,
      empty_qty REAL NOT NULL DEFAULT 0,
      bank_account TEXT,
      expense1_label TEXT,
      expense1_amount REAL NOT NULL DEFAULT 0,
      expense2_label TEXT,
      expense2_amount REAL NOT NULL DEFAULT 0,
      expense3_label TEXT,
      expense3_amount REAL NOT NULL DEFAULT 0,
      total_commission REAL NOT NULL DEFAULT 0,
      total_discount REAL NOT NULL DEFAULT 0,
      total_bill_expense REAL NOT NULL DEFAULT 0,
      notes TEXT,
      created_at TEXT NOT NULL DEFAULT (datetime('now','localtime'))
    );

    CREATE TABLE IF NOT EXISTS sale_items (
      id INTEGER PRIMARY KEY AUTOINCREMENT,
      sale_id INTEGER NOT NULL REFERENCES sales(id) ON DELETE CASCADE,
      product_id INTEGER NOT NULL REFERENCES products(id),
      product_name TEXT,
      quantity REAL NOT NULL DEFAULT 0,
      unit_price REAL NOT NULL DEFAULT 0,
      commission REAL NOT NULL DEFAULT 0,
      discount REAL NOT NULL DEFAULT 0,
      total REAL NOT NULL DEFAULT 0
    );

    CREATE TABLE IF NOT EXISTS company_info (
      id INTEGER PRIMARY KEY CHECK (id = 1),
      name TEXT NOT NULL DEFAULT 'Pepsi Distribution',
      phone TEXT,
      email TEXT,
      address TEXT,
      city TEXT,
      ntn TEXT,
      owner_name TEXT,
      logo_note TEXT,
      updated_at TEXT NOT NULL DEFAULT (datetime('now','localtime'))
    );

    CREATE TABLE IF NOT EXISTS app_settings (
      key TEXT PRIMARY KEY,
      value TEXT NOT NULL
    );

    CREATE TABLE IF NOT EXISTS expenses (
      id INTEGER PRIMARY KEY AUTOINCREMENT,
      expense_date TEXT NOT NULL DEFAULT (date('now','localtime')),
      category TEXT NOT NULL DEFAULT 'General',
      title TEXT NOT NULL,
      amount REAL NOT NULL DEFAULT 0,
      paid_from TEXT DEFAULT 'Cash',
      salesman_id INTEGER REFERENCES salesmen(id),
      notes TEXT,
      created_at TEXT NOT NULL DEFAULT (datetime('now','localtime'))
    );

    CREATE TABLE IF NOT EXISTS accounts (
      id INTEGER PRIMARY KEY AUTOINCREMENT,
      name TEXT NOT NULL,
      account_type TEXT NOT NULL,
      phone TEXT,
      opening_balance REAL NOT NULL DEFAULT 0,
      balance REAL NOT NULL DEFAULT 0,
      notes TEXT,
      created_at TEXT NOT NULL DEFAULT (datetime('now','localtime'))
    );

    CREATE TABLE IF NOT EXISTS general_entries (
      id INTEGER PRIMARY KEY AUTOINCREMENT,
      entry_date TEXT NOT NULL DEFAULT (date('now','localtime')),
      account_id INTEGER NOT NULL REFERENCES accounts(id),
      entry_type TEXT NOT NULL CHECK (entry_type IN ('debit', 'credit')),
      amount REAL NOT NULL DEFAULT 0,
      narration TEXT,
      ref_no TEXT,
      created_at TEXT NOT NULL DEFAULT (datetime('now','localtime'))
    );

    CREATE TABLE IF NOT EXISTS stock_transfers (
      id INTEGER PRIMARY KEY AUTOINCREMENT,
      transfer_date TEXT NOT NULL DEFAULT (date('now','localtime')),
      product_id INTEGER NOT NULL REFERENCES products(id),
      from_location TEXT NOT NULL DEFAULT 'main',
      to_location TEXT NOT NULL,
      quantity REAL NOT NULL DEFAULT 0,
      notes TEXT,
      created_at TEXT NOT NULL DEFAULT (datetime('now','localtime'))
    );

    CREATE TABLE IF NOT EXISTS stock_adjustments (
      id INTEGER PRIMARY KEY AUTOINCREMENT,
      adjust_date TEXT NOT NULL DEFAULT (date('now','localtime')),
      product_id INTEGER NOT NULL REFERENCES products(id),
      old_qty REAL NOT NULL DEFAULT 0,
      new_qty REAL NOT NULL DEFAULT 0,
      difference REAL NOT NULL DEFAULT 0,
      reason TEXT,
      notes TEXT,
      created_at TEXT NOT NULL DEFAULT (datetime('now','localtime'))
    );

    CREATE TABLE IF NOT EXISTS floors (
      id INTEGER PRIMARY KEY AUTOINCREMENT,
      name TEXT NOT NULL UNIQUE,
      notes TEXT,
      created_at TEXT NOT NULL DEFAULT (datetime('now','localtime'))
    );

    CREATE TABLE IF NOT EXISTS paper_days (
      id INTEGER PRIMARY KEY AUTOINCREMENT,
      entry_date TEXT NOT NULL UNIQUE,
      notes TEXT,
      status TEXT NOT NULL DEFAULT 'in_progress',
      created_at TEXT NOT NULL DEFAULT (datetime('now','localtime')),
      updated_at TEXT NOT NULL DEFAULT (datetime('now','localtime'))
    );
  `);

  addColumn(db, "products", "location", "TEXT NOT NULL DEFAULT 'main'");
  addColumn(db, "purchases", "company_name", "TEXT");
  addColumn(db, "purchases", "is_historical", "INTEGER NOT NULL DEFAULT 0");
  addColumn(db, "purchase_items", "product_name", "TEXT");
  addColumn(db, "purchase_items", "company_name", "TEXT");
  addColumn(db, "purchase_items", "size", "TEXT");
  addColumn(db, "purchase_items", "hand_to_hand", "REAL NOT NULL DEFAULT 0");
  addColumn(db, "purchase_items", "conditional", "REAL NOT NULL DEFAULT 0");
  addColumn(db, "purchase_items", "rate_per_cotton", "REAL NOT NULL DEFAULT 0");
  addColumn(db, "purchase_items", "total_rate", "REAL NOT NULL DEFAULT 0");
  addColumn(db, "sale_items", "product_name", "TEXT");
  addColumn(db, "sale_items", "commission", "REAL NOT NULL DEFAULT 0");
  addColumn(db, "sale_items", "discount", "REAL NOT NULL DEFAULT 0");
  addColumn(db, "sale_items", "commission_rate", "REAL NOT NULL DEFAULT 0");
  addColumn(db, "sale_items", "discount_rate", "REAL NOT NULL DEFAULT 0");
  addColumn(db, "sales", "bill_bakaya", "REAL NOT NULL DEFAULT 0");
  addColumn(db, "sales", "empty_qty", "REAL NOT NULL DEFAULT 0");
  addColumn(db, "sales", "bank_account", "TEXT");
  addColumn(db, "sales", "expense1_label", "TEXT");
  addColumn(db, "sales", "expense1_amount", "REAL NOT NULL DEFAULT 0");
  addColumn(db, "sales", "expense2_label", "TEXT");
  addColumn(db, "sales", "expense2_amount", "REAL NOT NULL DEFAULT 0");
  addColumn(db, "sales", "expense3_label", "TEXT");
  addColumn(db, "sales", "expense3_amount", "REAL NOT NULL DEFAULT 0");
  addColumn(db, "sales", "total_commission", "REAL NOT NULL DEFAULT 0");
  addColumn(db, "sales", "total_discount", "REAL NOT NULL DEFAULT 0");
  addColumn(db, "sales", "total_bill_expense", "REAL NOT NULL DEFAULT 0");
  addColumn(db, "sales", "is_historical", "INTEGER NOT NULL DEFAULT 0");
  addColumn(db, "expenses", "is_historical", "INTEGER NOT NULL DEFAULT 0");
  addColumn(db, "purchases", "expense1_label", "TEXT");
  addColumn(db, "purchases", "expense1_amount", "REAL NOT NULL DEFAULT 0");
  addColumn(db, "purchases", "expense2_label", "TEXT");
  addColumn(db, "purchases", "expense2_amount", "REAL NOT NULL DEFAULT 0");
  addColumn(db, "purchases", "expense3_label", "TEXT");
  addColumn(db, "purchases", "expense3_amount", "REAL NOT NULL DEFAULT 0");
  addColumn(db, "purchases", "total_expense", "REAL NOT NULL DEFAULT 0");

  const company = db.prepare("SELECT id FROM company_info WHERE id = 1").get();
  if (!company) {
    db.prepare(
      `INSERT INTO company_info (id, name, phone, address, city, owner_name)
       VALUES (1, 'Pepsi Distribution', '', '', '', 'Admin')`
    ).run();
  }

  const pwd = db.prepare("SELECT value FROM app_settings WHERE key = 'password_hash'").get();
  if (!pwd) {
    db.prepare("INSERT INTO app_settings (key, value) VALUES ('password_hash', ?)").run(
      hashPassword("admin123")
    );
  }

  const settingsPwd = db
    .prepare("SELECT value FROM app_settings WHERE key = 'settings_password_hash'")
    .get();
  if (!settingsPwd) {
    db.prepare("INSERT INTO app_settings (key, value) VALUES ('settings_password_hash', ?)").run(
      hashPassword("settings123")
    );
  }

  const floorCount = db.prepare("SELECT COUNT(*) as c FROM floors").get() as { c: number };
  if (floorCount.c === 0) {
    db.prepare("INSERT INTO floors (name) VALUES (?), (?), (?)").run(
      "Main Godown",
      "Floor 1",
      "Counter"
    );
  }

  const accCount = db.prepare("SELECT COUNT(*) as c FROM accounts").get() as { c: number };
  if (accCount.c === 0) {
    const ins = db.prepare(
      "INSERT INTO accounts (name, account_type, opening_balance, balance) VALUES (?, ?, 0, 0)"
    );
    for (const [name, type] of [
      ["Cash Counter", "counter"],
      ["Main Bank", "bank"],
      ["General Expense", "expense"],
      ["General Account", "general"],
      ["Pepsi Company", "supplier"],
    ] as Array<[string, string]>) {
      ins.run(name, type);
    }
  }

  ensureSyncSchema(db);
}

function createDb() {
  const db = new Database(dbPath);
  db.pragma("journal_mode = WAL");
  db.pragma("foreign_keys = ON");
  ensureSchema(db);
  (db as Database.Database & { __schemaOk?: boolean }).__schemaOk = true;
  return db;
}

export function hashPassword(password: string) {
  return crypto.createHash("sha256").update(`pepsi:${password}`).digest("hex");
}

export function getDb() {
  if (!globalForDb.__pepsiDb) {
    globalForDb.__pepsiDb = createDb();
  } else {
    // Always re-run lightweight migrations so new columns/tables appear after code updates
    ensureSchema(globalForDb.__pepsiDb);
    (globalForDb.__pepsiDb as Database.Database & { __schemaOk?: boolean }).__schemaOk = true;
  }
  return globalForDb.__pepsiDb;
}

export function resetDbConnection() {
  if (globalForDb.__pepsiDb) {
    globalForDb.__pepsiDb.close();
    globalForDb.__pepsiDb = undefined;
  }
}
