import { test } from "node:test";
import assert from "node:assert";
import { DatabaseSync } from "node:sqlite";
import { manualEntriesSQL } from "./ledger-sql";

function makeDb() {
  const db = new DatabaseSync(":memory:");
  db.exec(`
    CREATE TABLE purchases (
      id INTEGER PRIMARY KEY AUTOINCREMENT,
      invoice_no TEXT, company_name TEXT, supplier TEXT,
      purchase_date TEXT, total_amount REAL, paid_amount REAL,
      total_expense REAL, deleted INTEGER DEFAULT 0
    );
    CREATE TABLE purchase_items (
      id INTEGER PRIMARY KEY AUTOINCREMENT,
      purchase_id INTEGER, quantity REAL,
      hand_to_hand REAL DEFAULT 0, conditional REAL DEFAULT 0
    );
    CREATE TABLE manual_ledger_entries (
      id INTEGER PRIMARY KEY AUTOINCREMENT,
      ledger_type TEXT, entry_date TEXT, ref TEXT, party TEXT,
      debit REAL DEFAULT 0, credit REAL DEFAULT 0,
      source TEXT, notes TEXT, sub_type TEXT, deleted INTEGER DEFAULT 0
    );
    CREATE TABLE sales (
      id INTEGER PRIMARY KEY AUTOINCREMENT,
      invoice_no TEXT, sale_date TEXT, total_amount REAL, paid_amount REAL,
      bill_bakaya REAL DEFAULT 0, total_discount REAL DEFAULT 0, empty_qty REAL DEFAULT 0,
      is_historical INTEGER DEFAULT 0, deleted INTEGER DEFAULT 0
    );
    CREATE TABLE sales_returns (
      id INTEGER PRIMARY KEY AUTOINCREMENT,
      sale_id INTEGER, product_id INTEGER, qty REAL, rate REAL DEFAULT 0,
      return_date TEXT, deleted INTEGER DEFAULT 0
    );
    CREATE TABLE purchase_returns (
      id INTEGER PRIMARY KEY AUTOINCREMENT,
      purchase_id INTEGER, product_id INTEGER, qty REAL, rate REAL DEFAULT 0,
      return_date TEXT, deleted INTEGER DEFAULT 0
    );
  `);
  // old purchase (pre-manual-ledger era) - must come from the purchases branch
  db.prepare(
    "INSERT INTO purchases (invoice_no, company_name, supplier, purchase_date, total_amount, paid_amount, total_expense, deleted) VALUES ('PUR-001', 'Pepsi Company', 'Pepsi Company', '2026-07-01', 50000, 50000, 0, 0)"
  ).run();
  db.prepare(
    "INSERT INTO purchase_items (purchase_id, quantity, hand_to_hand, conditional) VALUES (1, 50, 10, 0)"
  ).run();
  db.prepare(
    "INSERT INTO purchase_items (purchase_id, quantity, hand_to_hand, conditional) VALUES (1, 25, 0, 8)"
  ).run();
  // new purchase WITH auto-posted manual entries - must come from manual branch only
  db.prepare(
    "INSERT INTO purchases (invoice_no, company_name, supplier, purchase_date, total_amount, paid_amount, total_expense, deleted) VALUES ('4915213100', 'Pepsi Company', 'Pepsi Company', '2026-07-28', 1036000, 5000, 0, 0)"
  ).run();
  db.prepare(
    "INSERT INTO manual_ledger_entries (ledger_type, entry_date, ref, party, debit, credit, source, notes, sub_type, deleted) VALUES ('company', '2026-07-28', '4915213100', 'Pepsi Company', 1036000, 5000, 'Purchase', 'Auto posting purchase 4915213100', 'company', 0)"
  ).run();
  return db;
}

function buildCompanySQL(from: string | null, to: string | null) {
  const params: string[] = [];
  let sql = `SELECT id, purchase_date as date, invoice_no as ref, COALESCE(company_name, supplier) as party,
         total_amount as debit, paid_amount as credit, 'Purchase' as source,
         CAST(COALESCE(total_expense, 0) as TEXT) as notes, NULL as sub_type, 0 as manual
         FROM purchases WHERE (deleted IS NULL OR deleted = 0)
         AND NOT EXISTS (
           SELECT 1 FROM manual_ledger_entries m
           WHERE m.ledger_type = 'company' AND (m.deleted IS NULL OR m.deleted = 0)
             AND m.source = 'Purchase'
             AND (m.sub_type IS NULL OR m.sub_type = '' OR m.sub_type = 'company')
             AND m.ref = COALESCE(purchases.invoice_no, '#' || purchases.id)
         )`;
  if (from) { sql += " AND purchase_date >= ?"; params.push(from); }
  if (to) { sql += " AND purchase_date <= ?"; params.push(to); }
  sql += ` UNION ALL ${manualEntriesSQL("company", "company", from, to, params)}`;
  sql += " ORDER BY date DESC, id DESC";
  return { sql, params };
}

test("company ledger compound SQL has exactly one ORDER BY", () => {
  const { sql } = buildCompanySQL(null, null);
  const orderBys = sql.split("ORDER BY");
  assert.strictEqual(orderBys.length, 2, `expected 1 ORDER BY, got SQL:\n${sql}`);
});

test("company ledger shows old purchase from table and new purchase via manual entry", () => {
  const db = makeDb();
  const { sql, params } = buildCompanySQL(null, null);
  const rows = db.prepare(sql).all(...params) as Array<{ ref: string; manual: number; debit: number }>;
  assert.strictEqual(rows.length, 2);
  const byRef = Object.fromEntries(rows.map((r) => [r.ref, r]));
  assert.ok(byRef["PUR-001"], "old purchase missing from company ledger");
  assert.strictEqual(byRef["PUR-001"].manual, 0);
  assert.ok(byRef["4915213100"], "new purchase missing from company ledger");
  assert.strictEqual(byRef["4915213100"].manual, 1);
  assert.strictEqual(byRef["4915213100"].debit, 1036000);
});

test("conditional and hand-to-hand are per-pack rates multiplied by quantity", () => {
  const db = makeDb();
  const run = (subType: string) => {
    const params: string[] = [];
    const sql = `SELECT id, purchase_date as date, invoice_no as ref, COALESCE(company_name, supplier) as party,
           COALESCE((SELECT SUM(conditional * quantity) FROM purchase_items WHERE purchase_id = purchases.id), 0) as debit,
           0 as credit, 'Conditional' as source,
           COALESCE((SELECT printf('%.0f/pack x %.0f qty', MAX(conditional), SUM(quantity)) FROM purchase_items WHERE purchase_id = purchases.id), '') as notes,
           NULL as sub_type, 0 as manual
           FROM purchases WHERE (deleted IS NULL OR deleted = 0) AND COALESCE((SELECT SUM(conditional * quantity) FROM purchase_items WHERE purchase_id = purchases.id), 0) > 0
           UNION ALL ${manualEntriesSQL("company", subType, null, null, params)}
           ORDER BY date DESC, id DESC`;
    return db.prepare(sql).all(...params) as Array<{ ref: string; debit: number; notes: string }>;
  };

  // conditional: 25 qty x 8/pack = 200
  const cond = run("company-conditional");
  assert.strictEqual(cond.length, 1);
  assert.strictEqual(cond[0].ref, "PUR-001");
  assert.strictEqual(cond[0].debit, 200);
  assert.ok(cond[0].notes.includes("8/pack"), `expected per-pack note, got: ${cond[0].notes}`);

  // hand-to-hand: 50 qty x 10/pack = 500
  const params2: string[] = [];
  const handSQL = `SELECT id, purchase_date as date, invoice_no as ref, COALESCE(company_name, supplier) as party,
           COALESCE((SELECT SUM(hand_to_hand * quantity) FROM purchase_items WHERE purchase_id = purchases.id), 0) as debit,
           0 as credit, 'Hand to Hand' as source,
           COALESCE((SELECT printf('%.0f/pack x %.0f qty', MAX(hand_to_hand), SUM(quantity)) FROM purchase_items WHERE purchase_id = purchases.id), '') as notes,
           NULL as sub_type, 0 as manual
           FROM purchases WHERE (deleted IS NULL OR deleted = 0) AND COALESCE((SELECT SUM(hand_to_hand * quantity) FROM purchase_items WHERE purchase_id = purchases.id), 0) > 0
           UNION ALL ${manualEntriesSQL("company", "company-hand", null, null, params2)}
           ORDER BY date DESC, id DESC`;
  const hand = db.prepare(handSQL).all(...params2) as Array<{ ref: string; debit: number }>;
  assert.strictEqual(hand.length, 1);
  assert.strictEqual(hand[0].ref, "PUR-001");
  assert.strictEqual(hand[0].debit, 500);
});
