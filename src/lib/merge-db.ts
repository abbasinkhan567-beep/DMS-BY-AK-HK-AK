import fs from "fs";
import path from "path";
import {
  ensureSyncSchema,
  productMovementNet,
  recalculateStockAndBalances,
  newSyncId,
} from "@/lib/sync-ids";
import { getDb } from "@/lib/db";
import { openDatabase, type PepsiDb } from "@/lib/sqlite";

export type MergeStats = {
  added: number;
  updated: number;
  message: string;
};

function newer(a?: string | null, b?: string | null) {
  const aa = a || "";
  const bb = b || "";
  return aa > bb;
}

function cols(db: PepsiDb, table: string) {
  return (db.prepare(`PRAGMA table_info(${table})`).all() as Array<{ name: string }>).map(
    (c) => c.name
  );
}

function captureOpenings(db: PepsiDb) {
  const map = new Map<string, number>();
  const rows = db.prepare("SELECT id, sync_id, stock FROM products").all() as Array<{
    id: number;
    sync_id: string;
    stock: number;
  }>;
  for (const r of rows) {
    if (!r.sync_id) continue;
    map.set(r.sync_id, Number(r.stock) - productMovementNet(db, r.id));
  }
  return map;
}

function idBySync(db: PepsiDb, table: string, syncId: string | null | undefined) {
  if (!syncId) return null;
  const row = db.prepare(`SELECT id FROM ${table} WHERE sync_id = ?`).get(syncId) as
    | { id: number }
    | undefined;
  return row?.id ?? null;
}

function syncOf(db: PepsiDb, table: string, id: number | null | undefined) {
  if (!id) return null;
  const row = db.prepare(`SELECT sync_id FROM ${table} WHERE id = ?`).get(id) as
    | { sync_id: string }
    | undefined;
  return row?.sync_id || null;
}

function remapFk(
  local: PepsiDb,
  remote: PepsiDb,
  table: string,
  remoteId: number | null | undefined
) {
  if (remoteId == null) return null;
  const sid = syncOf(remote, table, remoteId);
  if (!sid) return null;
  return idBySync(local, table, sid);
}

/** Merge remote SQLite into local DB by sync_id (both PCs keep their rows). */
export function mergeRemoteIntoLocal(remoteDbPath: string): MergeStats {
  const local = getDb();
  ensureSyncSchema(local);

  const tmp = path.join(path.dirname(remoteDbPath), `merge-remote-${Date.now()}.db`);
  fs.copyFileSync(remoteDbPath, tmp);
  const remote = openDatabase(tmp);
  remote.pragma("foreign_keys = OFF");
  ensureSyncSchema(remote);

  const openings = captureOpenings(local);
  const remoteOpenings = captureOpenings(remote);
  for (const [k, v] of remoteOpenings) {
    if (!openings.has(k)) openings.set(k, v);
  }

  let added = 0;
  let updated = 0;

  const mergeTx = local.transaction(() => {
    local.pragma("foreign_keys = OFF");

    added += mergeMasters(local, remote, "floors", ["name", "notes", "created_at"], (stats) => {
      updated += stats.updated;
      return stats.added;
    });
    added += mergeMasters(
      local,
      remote,
      "salesmen",
      ["name", "phone", "area", "salary", "status", "created_at"],
      (stats) => {
        updated += stats.updated;
        return stats.added;
      }
    );
    added += mergeMasters(
      local,
      remote,
      "products",
      [
        "name",
        "size",
        "unit",
        "purchase_price",
        "sale_price",
        "min_stock",
        "location",
        "created_at",
      ],
      (stats) => {
        updated += stats.updated;
        return stats.added;
      }
    );
    added += mergeMasters(
      local,
      remote,
      "customers",
      ["name", "shop_name", "phone", "address", "area", "notes", "created_at"],
      (stats) => {
        updated += stats.updated;
        return stats.added;
      }
    );
    added += mergeMasters(
      local,
      remote,
      "accounts",
      ["name", "account_type", "phone", "opening_balance", "notes", "created_at"],
      (stats) => {
        updated += stats.updated;
        return stats.added;
      }
    );

    added += mergePurchases(local, remote, (u) => {
      updated += u;
    });
    added += mergeSales(local, remote, (u) => {
      updated += u;
    });
    added += mergeSimpleTx(
      local,
      remote,
      "expenses",
      [
        "expense_date",
        "category",
        "title",
        "amount",
        "paid_from",
        "notes",
        "is_historical",
        "created_at",
      ],
      (row) => ({
        salesman_id: remapFk(local, remote, "salesmen", row.salesman_id as number | null),
      }),
      (u) => {
        updated += u;
      }
    );
    added += mergeSimpleTx(
      local,
      remote,
      "general_entries",
      ["entry_date", "entry_type", "amount", "narration", "ref_no", "created_at"],
      (row) => ({
        account_id: remapFk(local, remote, "accounts", row.account_id as number),
      }),
      (u) => {
        updated += u;
      },
      (extras) => extras.account_id != null
    );
    added += mergeSimpleTx(
      local,
      remote,
      "stock_transfers",
      ["transfer_date", "from_location", "to_location", "quantity", "notes", "created_at"],
      (row) => ({
        product_id: remapFk(local, remote, "products", row.product_id as number),
      }),
      (u) => {
        updated += u;
      },
      (extras) => extras.product_id != null
    );
    added += mergeSimpleTx(
      local,
      remote,
      "stock_adjustments",
      ["adjust_date", "old_qty", "new_qty", "difference", "reason", "notes", "created_at"],
      (row) => ({
        product_id: remapFk(local, remote, "products", row.product_id as number),
      }),
      (u) => {
        updated += u;
      },
      (extras) => extras.product_id != null
    );
    added += mergePaperDays(local, remote, (u) => {
      updated += u;
    });
    mergeCompany(local, remote, (u) => {
      updated += u;
    });

    const products = local.prepare("SELECT id, sync_id, stock FROM products").all() as Array<{
      id: number;
      sync_id: string;
      stock: number;
    }>;
    for (const p of products) {
      const opening =
        openings.get(p.sync_id) ?? Number(p.stock) - productMovementNet(local, p.id);
      const stock = opening + productMovementNet(local, p.id);
      local
        .prepare(
          `UPDATE products SET stock = ?, updated_at = datetime('now','localtime') WHERE id = ?`
        )
        .run(stock, p.id);
    }
    recalculateStockAndBalances(local);

    local.pragma("foreign_keys = ON");
  });

  try {
    mergeTx();
  } finally {
    remote.close();
    try {
      fs.unlinkSync(tmp);
    } catch {
      /* ignore */
    }
    for (const extra of [`${tmp}-wal`, `${tmp}-shm`]) {
      try {
        if (fs.existsSync(extra)) fs.unlinkSync(extra);
      } catch {
        /* ignore */
      }
    }
  }

  return {
    added,
    updated,
    message:
      added || updated
        ? `Synced: ${added} new entries added, ${updated} entries updated.`
        : "Already up to date — same data on both PCs.",
  };
}

function mergeMasters(
  local: PepsiDb,
  remote: PepsiDb,
  table: string,
  fields: string[],
  onStats: (s: { added: number; updated: number }) => number
) {
  let added = 0;
  let updated = 0;
  const remoteCols = new Set(cols(remote, table));
  const localCols = new Set(cols(local, table));
  const rows = remote.prepare(`SELECT * FROM ${table}`).all() as Array<Record<string, unknown>>;

  for (const row of rows) {
    const syncId = String(row.sync_id || "");
    if (!syncId) continue;
    const existing = local.prepare(`SELECT * FROM ${table} WHERE sync_id = ?`).get(syncId) as
      | Record<string, unknown>
      | undefined;

    const useFields = fields.filter((f) => remoteCols.has(f) && localCols.has(f));

    if (!existing) {
      const insertFields = ["sync_id", "updated_at", ...useFields].filter(
        (f, i, arr) => arr.indexOf(f) === i && localCols.has(f)
      );
      const values = insertFields.map((f) => {
        if (f === "sync_id") return syncId;
        if (f === "updated_at") return row.updated_at || row.created_at || new Date().toISOString();
        return row[f] ?? null;
      });
      if (localCols.has("stock") && !insertFields.includes("stock")) {
        insertFields.push("stock");
        values.push(row.stock ?? 0);
      }
      if (localCols.has("balance") && !insertFields.includes("balance")) {
        insertFields.push("balance");
        values.push(0);
      }
      local
        .prepare(
          `INSERT INTO ${table} (${insertFields.join(",")}) VALUES (${insertFields
            .map(() => "?")
            .join(",")})`
        )
        .run(...values);
      added++;
    } else if (newer(String(row.updated_at || ""), String(existing.updated_at || ""))) {
      const sets = useFields.map((f) => `${f}=?`).join(", ");
      local
        .prepare(`UPDATE ${table} SET ${sets}, updated_at=? WHERE sync_id=?`)
        .run(...useFields.map((f) => row[f] ?? null), row.updated_at || existing.updated_at, syncId);
      updated++;
    }
  }

  onStats({ added, updated });
  return added;
}

function mergePurchases(
  local: PepsiDb,
  remote: PepsiDb,
  onUpdated: (n: number) => void
) {
  let added = 0;
  let updated = 0;
  const purchases = remote.prepare("SELECT * FROM purchases").all() as Array<Record<string, unknown>>;

  for (const row of purchases) {
    const syncId = String(row.sync_id || "");
    if (!syncId) continue;
    const existing = local
      .prepare("SELECT id, updated_at FROM purchases WHERE sync_id = ?")
      .get(syncId) as { id: number; updated_at: string } | undefined;

    if (!existing) {
      const result = local
        .prepare(
          `INSERT INTO purchases (
            sync_id, updated_at, invoice_no, supplier, company_name, purchase_date, total_amount, paid_amount, notes,
            is_historical, expense1_label, expense1_amount, expense2_label, expense2_amount, expense3_label, expense3_amount,
            total_expense, created_at
          ) VALUES (?,?,?,?,?,?,?,?,?,?,?,?,?,?,?,?,?,?)`
        )
        .run(
          syncId,
          row.updated_at || row.created_at || new Date().toISOString(),
          row.invoice_no ?? null,
          row.supplier ?? "Pepsi Company",
          row.company_name ?? null,
          row.purchase_date,
          row.total_amount ?? 0,
          row.paid_amount ?? 0,
          row.notes ?? null,
          row.is_historical ?? 0,
          row.expense1_label ?? null,
          row.expense1_amount ?? 0,
          row.expense2_label ?? null,
          row.expense2_amount ?? 0,
          row.expense3_label ?? null,
          row.expense3_amount ?? 0,
          row.total_expense ?? 0,
          row.created_at ?? null
        );
      const localPurchaseId = Number(result.lastInsertRowid);
      const items = remote
        .prepare("SELECT * FROM purchase_items WHERE purchase_id = ?")
        .all(row.id) as Array<Record<string, unknown>>;
      for (const item of items) {
        const productId = remapFk(local, remote, "products", item.product_id as number);
        if (!productId) continue;
        local
          .prepare(
            `INSERT INTO purchase_items (
              sync_id, updated_at, purchase_id, product_id, product_name, company_name, size, quantity,
              hand_to_hand, conditional, rate_per_cotton, unit_price, total_rate, total
            ) VALUES (?,?,?,?,?,?,?,?,?,?,?,?,?,?)`
          )
          .run(
            item.sync_id || newSyncId(),
            item.updated_at || new Date().toISOString(),
            localPurchaseId,
            productId,
            item.product_name ?? null,
            item.company_name ?? null,
            item.size ?? null,
            item.quantity ?? 0,
            item.hand_to_hand ?? 0,
            item.conditional ?? 0,
            item.rate_per_cotton ?? 0,
            item.unit_price ?? 0,
            item.total_rate ?? 0,
            item.total ?? 0
          );
      }
      added++;
    } else if (newer(String(row.updated_at || ""), existing.updated_at)) {
      local
        .prepare(
          `UPDATE purchases SET
            invoice_no=?, supplier=?, company_name=?, purchase_date=?, total_amount=?, paid_amount=?, notes=?,
            is_historical=?, expense1_label=?, expense1_amount=?, expense2_label=?, expense2_amount=?,
            expense3_label=?, expense3_amount=?, total_expense=?, updated_at=?
           WHERE id=?`
        )
        .run(
          row.invoice_no ?? null,
          row.supplier ?? "Pepsi Company",
          row.company_name ?? null,
          row.purchase_date,
          row.total_amount ?? 0,
          row.paid_amount ?? 0,
          row.notes ?? null,
          row.is_historical ?? 0,
          row.expense1_label ?? null,
          row.expense1_amount ?? 0,
          row.expense2_label ?? null,
          row.expense2_amount ?? 0,
          row.expense3_label ?? null,
          row.expense3_amount ?? 0,
          row.total_expense ?? 0,
          row.updated_at,
          existing.id
        );
      updated++;
    }
  }
  onUpdated(updated);
  return added;
}

function mergeSales(
  local: PepsiDb,
  remote: PepsiDb,
  onUpdated: (n: number) => void
) {
  let added = 0;
  let updated = 0;
  const sales = remote.prepare("SELECT * FROM sales").all() as Array<Record<string, unknown>>;

  for (const row of sales) {
    const syncId = String(row.sync_id || "");
    if (!syncId) continue;
    const existing = local.prepare("SELECT id, updated_at FROM sales WHERE sync_id = ?").get(syncId) as
      | { id: number; updated_at: string }
      | undefined;

    const customerId = remapFk(local, remote, "customers", row.customer_id as number);
    if (!customerId) continue;
    const salesmanId = remapFk(local, remote, "salesmen", row.salesman_id as number | null);

    if (!existing) {
      const result = local
        .prepare(
          `INSERT INTO sales (
            sync_id, updated_at, invoice_no, customer_id, salesman_id, sale_date, total_amount, paid_amount,
            payment_type, bill_bakaya, empty_qty, bank_account,
            expense1_label, expense1_amount, expense2_label, expense2_amount, expense3_label, expense3_amount,
            total_commission, total_discount, total_bill_expense, notes, is_historical, created_at
          ) VALUES (?,?,?,?,?,?,?,?,?,?,?,?,?,?,?,?,?,?,?,?,?,?,?,?)`
        )
        .run(
          syncId,
          row.updated_at || row.created_at || new Date().toISOString(),
          row.invoice_no ?? null,
          customerId,
          salesmanId,
          row.sale_date,
          row.total_amount ?? 0,
          row.paid_amount ?? 0,
          row.payment_type ?? "cash",
          row.bill_bakaya ?? 0,
          row.empty_qty ?? 0,
          row.bank_account ?? null,
          row.expense1_label ?? null,
          row.expense1_amount ?? 0,
          row.expense2_label ?? null,
          row.expense2_amount ?? 0,
          row.expense3_label ?? null,
          row.expense3_amount ?? 0,
          row.total_commission ?? 0,
          row.total_discount ?? 0,
          row.total_bill_expense ?? 0,
          row.notes ?? null,
          row.is_historical ?? 0,
          row.created_at ?? null
        );
      const localSaleId = Number(result.lastInsertRowid);
      const items = remote
        .prepare("SELECT * FROM sale_items WHERE sale_id = ?")
        .all(row.id) as Array<Record<string, unknown>>;
      for (const item of items) {
        const productId = remapFk(local, remote, "products", item.product_id as number);
        if (!productId) continue;
        local
          .prepare(
            `INSERT INTO sale_items (
              sync_id, updated_at, sale_id, product_id, product_name, quantity, unit_price,
              commission, discount, commission_rate, discount_rate, total
            ) VALUES (?,?,?,?,?,?,?,?,?,?,?,?)`
          )
          .run(
            item.sync_id || newSyncId(),
            item.updated_at || new Date().toISOString(),
            localSaleId,
            productId,
            item.product_name ?? null,
            item.quantity ?? 0,
            item.unit_price ?? 0,
            item.commission ?? 0,
            item.discount ?? 0,
            item.commission_rate ?? 0,
            item.discount_rate ?? 0,
            item.total ?? 0
          );
      }
      added++;
    } else if (newer(String(row.updated_at || ""), existing.updated_at)) {
      local
        .prepare(
          `UPDATE sales SET
            invoice_no=?, customer_id=?, salesman_id=?, sale_date=?, total_amount=?, paid_amount=?,
            payment_type=?, bill_bakaya=?, empty_qty=?, bank_account=?,
            expense1_label=?, expense1_amount=?, expense2_label=?, expense2_amount=?,
            expense3_label=?, expense3_amount=?, total_commission=?, total_discount=?,
            total_bill_expense=?, notes=?, is_historical=?, updated_at=?
           WHERE id=?`
        )
        .run(
          row.invoice_no ?? null,
          customerId,
          salesmanId,
          row.sale_date,
          row.total_amount ?? 0,
          row.paid_amount ?? 0,
          row.payment_type ?? "cash",
          row.bill_bakaya ?? 0,
          row.empty_qty ?? 0,
          row.bank_account ?? null,
          row.expense1_label ?? null,
          row.expense1_amount ?? 0,
          row.expense2_label ?? null,
          row.expense2_amount ?? 0,
          row.expense3_label ?? null,
          row.expense3_amount ?? 0,
          row.total_commission ?? 0,
          row.total_discount ?? 0,
          row.total_bill_expense ?? 0,
          row.notes ?? null,
          row.is_historical ?? 0,
          row.updated_at,
          existing.id
        );
      updated++;
    }
  }
  onUpdated(updated);
  return added;
}

function mergeSimpleTx(
  local: PepsiDb,
  remote: PepsiDb,
  table: string,
  fields: string[],
  extra: (row: Record<string, unknown>) => Record<string, unknown>,
  onUpdated: (n: number) => void,
  accept?: (extras: Record<string, unknown>) => boolean
) {
  let added = 0;
  let updated = 0;
  const rows = remote.prepare(`SELECT * FROM ${table}`).all() as Array<Record<string, unknown>>;
  const localColSet = new Set(cols(local, table));

  for (const row of rows) {
    const syncId = String(row.sync_id || "");
    if (!syncId) continue;
    const existing = local.prepare(`SELECT id, updated_at FROM ${table} WHERE sync_id = ?`).get(syncId) as
      | { id: number; updated_at: string }
      | undefined;
    const extras = extra(row);
    if (accept && !accept(extras)) continue;

    if (!existing) {
      const insertFields = ["sync_id", "updated_at", ...fields, ...Object.keys(extras)].filter((f) =>
        localColSet.has(f)
      );
      const uniqueFields = [...new Set(insertFields)];
      const values = uniqueFields.map((f) => {
        if (f === "sync_id") return syncId;
        if (f === "updated_at") return row.updated_at || row.created_at || new Date().toISOString();
        if (f in extras) return extras[f];
        return row[f] ?? null;
      });
      local
        .prepare(
          `INSERT INTO ${table} (${uniqueFields.join(",")}) VALUES (${uniqueFields
            .map(() => "?")
            .join(",")})`
        )
        .run(...values);
      added++;
    } else if (newer(String(row.updated_at || ""), existing.updated_at)) {
      const setFields = [...fields, ...Object.keys(extras)].filter((f) => localColSet.has(f));
      const unique = [...new Set(setFields)];
      local
        .prepare(
          `UPDATE ${table} SET ${unique.map((f) => `${f}=?`).join(",")}, updated_at=? WHERE id=?`
        )
        .run(
          ...unique.map((f) => (f in extras ? extras[f] : row[f] ?? null)),
          row.updated_at,
          existing.id
        );
      updated++;
    }
  }
  onUpdated(updated);
  return added;
}

function mergePaperDays(
  local: PepsiDb,
  remote: PepsiDb,
  onUpdated: (n: number) => void
) {
  let added = 0;
  let updated = 0;
  const rows = remote.prepare("SELECT * FROM paper_days").all() as Array<Record<string, unknown>>;
  for (const row of rows) {
    const syncId = String(row.sync_id || "");
    if (!syncId) continue;
    const existing = local
      .prepare("SELECT id, updated_at, status FROM paper_days WHERE sync_id = ?")
      .get(syncId) as { id: number; updated_at: string; status: string } | undefined;
    if (!existing) {
      try {
        local
          .prepare(
            `INSERT INTO paper_days (sync_id, updated_at, entry_date, notes, status, created_at)
             VALUES (?,?,?,?,?,?)`
          )
          .run(
            syncId,
            row.updated_at || new Date().toISOString(),
            row.entry_date,
            row.notes ?? null,
            row.status ?? "in_progress",
            row.created_at ?? null
          );
        added++;
      } catch {
        local
          .prepare(
            `UPDATE paper_days SET notes=?, status=?, sync_id=?, updated_at=? WHERE entry_date=?`
          )
          .run(row.notes ?? null, row.status, syncId, row.updated_at, row.entry_date);
        updated++;
      }
    } else if (newer(String(row.updated_at || ""), existing.updated_at)) {
      const status =
        existing.status === "done" || row.status === "done" ? "done" : row.status || existing.status;
      local
        .prepare(`UPDATE paper_days SET notes=?, status=?, updated_at=? WHERE id=?`)
        .run(row.notes ?? null, status, row.updated_at, existing.id);
      updated++;
    } else if (row.status === "done" && existing.status !== "done") {
      local
        .prepare(`UPDATE paper_days SET status='done', updated_at=? WHERE id=?`)
        .run(row.updated_at || new Date().toISOString(), existing.id);
      updated++;
    }
  }
  onUpdated(updated);
  return added;
}

function mergeCompany(
  local: PepsiDb,
  remote: PepsiDb,
  onUpdated: (n: number) => void
) {
  const remoteRow = remote.prepare("SELECT * FROM company_info WHERE id = 1").get() as
    | Record<string, unknown>
    | undefined;
  const localRow = local.prepare("SELECT * FROM company_info WHERE id = 1").get() as
    | Record<string, unknown>
    | undefined;
  if (!remoteRow || !localRow) return;
  if (newer(String(remoteRow.updated_at || ""), String(localRow.updated_at || ""))) {
    local
      .prepare(
        `UPDATE company_info SET name=?, phone=?, email=?, address=?, city=?, ntn=?, owner_name=?, logo_note=?, updated_at=?
         WHERE id=1`
      )
      .run(
        remoteRow.name,
        remoteRow.phone,
        remoteRow.email,
        remoteRow.address,
        remoteRow.city,
        remoteRow.ntn,
        remoteRow.owner_name,
        remoteRow.logo_note,
        remoteRow.updated_at
      );
    onUpdated(1);
  }
}
