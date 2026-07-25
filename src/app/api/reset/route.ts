import { NextResponse } from "next/server";
import { createBackup } from "@/lib/backup";
import { getDb } from "@/lib/db";

export async function POST() {
  const db = getDb();
  try {
    createBackup("manual");
    const tx = db.transaction(() => {
      db.exec("DELETE FROM sale_items");
      db.exec("DELETE FROM sales");
      db.exec("DELETE FROM purchase_items");
      db.exec("DELETE FROM purchases");
      db.exec("DELETE FROM general_entries");
      db.exec("DELETE FROM stock_transfers");
      db.exec("DELETE FROM stock_adjustments");
      db.exec("DELETE FROM expenses");
      db.exec("DELETE FROM paper_days");
      db.exec("DELETE FROM products");
      db.exec("DELETE FROM customers");
      db.exec("DELETE FROM salesmen");
      db.exec("DELETE FROM accounts WHERE id > 5");
      db.exec("DELETE FROM floors WHERE id > 3");
      db.exec("DELETE FROM deleted_records");
      db.exec("DELETE FROM sqlite_sequence");
      db.prepare(
        `INSERT OR IGNORE INTO company_info (id, name, phone, address, city, owner_name)
         VALUES (1, 'Pepsi Distribution', '', '', '', 'Admin')`
      ).run();
      const ins = db.prepare(
        "INSERT OR IGNORE INTO accounts (name, account_type, opening_balance, balance) VALUES (?, ?, 0, 0)"
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
      db.prepare("INSERT OR IGNORE INTO floors (name) VALUES ('Main Godown')").run();
      db.prepare("INSERT OR IGNORE INTO floors (name) VALUES ('Floor 1')").run();
      db.prepare("INSERT OR IGNORE INTO floors (name) VALUES ('Counter')").run();
    });
    tx();
    return NextResponse.json({
      ok: true,
      message: "All data has been reset to factory defaults. A safety backup was created first.",
    });
  } catch (e) {
    return NextResponse.json(
      { error: e instanceof Error ? e.message : String(e) },
      { status: 500 }
    );
  }
}
