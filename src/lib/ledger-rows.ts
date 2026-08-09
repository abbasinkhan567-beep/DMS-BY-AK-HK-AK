import { getDb } from "@/lib/db";
import { manualEntriesSQL } from "@/lib/ledger-sql";

export type LedgerRow = {
  id: number;
  date: string;
  ref: string | null;
  party: string;
  debit: number;
  credit: number;
  source: string;
  notes: string | null;
  sub_type: string | null;
  manual: number;
};

export function dateFilter(column: string, from: string | null, to: string | null, params: string[]) {
  let sql = "";
  if (from) {
    sql += ` AND ${column} >= ?`;
    params.push(from);
  }
  if (to) {
    sql += ` AND ${column} <= ?`;
    params.push(to);
  }
  return sql;
}

export function getLedgerRows(
  type: string,
  subType: string,
  from: string | null,
  to: string | null
): LedgerRow[] {
  const db = getDb();

  if (type === "company") {
    const params: string[] = [];
    let sql: string;
    if (subType === "company-conditional") {
      sql = `SELECT id, purchase_date as date, invoice_no as ref, COALESCE(company_name, supplier) as party,
             COALESCE((SELECT SUM(conditional * quantity) FROM purchase_items WHERE purchase_id = purchases.id), 0) as debit,
             0 as credit, 'Conditional' as source,
             COALESCE((SELECT printf('%.2f/pack x %.2f qty', MAX(conditional), SUM(quantity)) FROM purchase_items WHERE purchase_id = purchases.id), '') as notes,
             NULL as sub_type, 0 as manual
             FROM purchases WHERE (deleted IS NULL OR deleted = 0) AND COALESCE((SELECT SUM(conditional * quantity) FROM purchase_items WHERE purchase_id = purchases.id), 0) > 0`;
    } else if (subType === "company-hand") {
      sql = `SELECT id, purchase_date as date, invoice_no as ref, COALESCE(company_name, supplier) as party,
             COALESCE((SELECT SUM(hand_to_hand * quantity) FROM purchase_items WHERE purchase_id = purchases.id), 0) as debit,
             0 as credit, 'Hand to Hand' as source,
             COALESCE((SELECT printf('%.2f/pack x %.2f qty', MAX(hand_to_hand), SUM(quantity)) FROM purchase_items WHERE purchase_id = purchases.id), '') as notes,
             NULL as sub_type, 0 as manual
             FROM purchases WHERE (deleted IS NULL OR deleted = 0) AND COALESCE((SELECT SUM(hand_to_hand * quantity) FROM purchase_items WHERE purchase_id = purchases.id), 0) > 0`;
    } else if (subType === "company-paid") {
      sql = `SELECT id, purchase_date as date, invoice_no as ref, COALESCE(company_name, supplier) as party,
             0 as debit, paid_amount as credit, 'Paid' as source,
             CAST(COALESCE(total_expense, 0) as TEXT) as notes,
             NULL as sub_type, 0 as manual
             FROM purchases WHERE (deleted IS NULL OR deleted = 0) AND paid_amount > 0`;
    } else {
      sql = `SELECT id, purchase_date as date, invoice_no as ref, COALESCE(company_name, supplier) as party,
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
    }
    sql += dateFilter("purchase_date", from, to, params);
    sql += ` UNION ALL ${manualEntriesSQL("company", subType, from, to, params)}`;
    sql += " ORDER BY date DESC, id DESC";
    return db.prepare(sql).all(...params) as LedgerRow[];
  }

  if (type === "expense") {
    const params: string[] = [];
    const sql = `
      SELECT id, expense_date as date, category as ref, title as party,
             amount as debit, 0 as credit, paid_from as source, notes, NULL as sub_type, 0 as manual
      FROM expenses WHERE (deleted IS NULL OR deleted = 0)
      AND NOT EXISTS (
        SELECT 1 FROM manual_ledger_entries m
        WHERE m.ledger_type = 'expense' AND (m.deleted IS NULL OR m.deleted = 0)
          AND m.ref = 'EXP-' || expenses.id
      )
      ${dateFilter("expense_date", from, to, params)}
      UNION ALL
      SELECT s.id, s.sale_date as date, 'Sale Bill Expense' as ref,
             COALESCE(c.shop_name, c.name) as party,
             s.total_bill_expense as debit, 0 as credit, 'Sale' as source,
             COALESCE(s.invoice_no, '#' || s.id) as notes, NULL as sub_type, 0 as manual
      FROM sales s
      JOIN customers c ON c.id = s.customer_id
      WHERE (s.deleted IS NULL OR s.deleted = 0) AND s.total_bill_expense > 0
      ${dateFilter("s.sale_date", from, to, params)}
      UNION ALL
      SELECT s.id, s.sale_date as date, 'Discount' as ref,
             COALESCE(c.shop_name, c.name) as party,
             s.total_discount as debit, 0 as credit, 'Sale Discount' as source,
             COALESCE(s.invoice_no, '#' || s.id) as notes, NULL as sub_type, 0 as manual
      FROM sales s
      JOIN customers c ON c.id = s.customer_id
      WHERE (s.deleted IS NULL OR s.deleted = 0) AND s.total_discount > 0
      ${dateFilter("s.sale_date", from, to, params)}
      UNION ALL
      SELECT p.id, p.purchase_date as date, 'Purchase Expense' as ref,
             COALESCE(p.company_name, p.supplier) as party,
             p.total_expense as debit, 0 as credit, 'Purchase' as source,
             COALESCE(p.invoice_no, '#' || p.id) as notes, NULL as sub_type, 0 as manual
      FROM purchases p
      WHERE (p.deleted IS NULL OR p.deleted = 0) AND COALESCE(p.total_expense, 0) > 0
      ${dateFilter("p.purchase_date", from, to, params)}
      UNION ALL ${manualEntriesSQL("expense", subType, from, to, params)}
      ORDER BY date DESC
    `;
    return db.prepare(sql).all(...params) as LedgerRow[];
  }

  if (type === "salesman") {
    const params: string[] = [];
    let sql: string;
    if (subType === "salesman-to-customer") {
      sql = `SELECT s.id, s.sale_date as date, s.invoice_no as ref,
             COALESCE(sm.name, 'No Salesman') as party,
             COALESCE(s.total_amount, 0) as debit,
             0 as credit,
             COALESCE(c.shop_name, c.name) as source,
             'Salesman -> Customer' as notes, NULL as sub_type, 0 as manual
             FROM sales s
             LEFT JOIN salesmen sm ON sm.id = s.salesman_id
             JOIN customers c ON c.id = s.customer_id
             WHERE (s.deleted IS NULL OR s.deleted = 0) AND s.salesman_id IS NOT NULL`;
    } else if (subType === "customer-to-salesman") {
      sql = `SELECT s.id, s.sale_date as date, s.invoice_no as ref,
             COALESCE(c.shop_name, c.name) as party,
             0 as debit,
             COALESCE(s.total_amount, 0) as credit,
             COALESCE(sm.name, 'No Salesman') as source,
             'Customer -> Salesman' as notes, NULL as sub_type, 0 as manual
             FROM sales s
             JOIN customers c ON c.id = s.customer_id
             LEFT JOIN salesmen sm ON sm.id = s.salesman_id
             WHERE (s.deleted IS NULL OR s.deleted = 0) AND s.salesman_id IS NOT NULL`;
    } else if (subType === "salesman-commission") {
      const retSql = `COALESCE((
               SELECT SUM(
                 CASE WHEN si.commission_rate > 0
                   THEN si.commission_rate * (r1.returned_qty * si.quantity * 1.0 / NULLIF(t.range_qty, 0))
                   ELSE si.commission * (r1.returned_qty * 1.0 / NULLIF(t.range_qty, 0))
                 END
               )
               FROM sale_items si
               JOIN (SELECT product_id, SUM(qty) as returned_qty FROM sales_returns
                     WHERE sale_id = s.id AND (deleted IS NULL OR deleted = 0)
                     GROUP BY product_id) r1 ON r1.product_id = si.product_id
               JOIN (SELECT product_id, SUM(quantity) as range_qty FROM sale_items
                     WHERE sale_id = s.id AND (deleted IS NULL OR deleted = 0)
                     GROUP BY product_id) t ON t.product_id = si.product_id
               WHERE si.sale_id = s.id AND (si.deleted IS NULL OR si.deleted = 0)
             ), 0)`;
      sql = `SELECT s.id, s.sale_date as date, s.invoice_no as ref,
             COALESCE(sm.name, 'No Salesman') as party,
             COALESCE(s.total_commission, 0) - ${retSql} as debit,
             0 as credit, COALESCE(c.shop_name, c.name) as source,
             'Commission: ' || printf('%.2f', COALESCE(s.total_commission, 0) - ${retSql}) || ' | Sale: ' || printf('%.2f', s.total_amount) as notes,
             NULL as sub_type, 0 as manual
             FROM sales s
             LEFT JOIN salesmen sm ON sm.id = s.salesman_id
             JOIN customers c ON c.id = s.customer_id
             WHERE (s.deleted IS NULL OR s.deleted = 0)
             AND s.salesman_id IS NOT NULL AND COALESCE(s.total_commission, 0) > 0`;
      sql += dateFilter("s.sale_date", from, to, params);
      sql += " ORDER BY party ASC, date ASC, s.id ASC";
      return db.prepare(sql).all(...params) as LedgerRow[];
    } else {
      sql = `SELECT s.id, s.sale_date as date, s.invoice_no as ref,
             COALESCE(sm.name, 'No Salesman') as party,
             COALESCE(s.total_commission, 0) -
             COALESCE((
               SELECT SUM(
                 CASE WHEN si.commission_rate > 0
                   THEN si.commission_rate * (r1.returned_qty * si.quantity * 1.0 / NULLIF(t.range_qty, 0))
                   ELSE si.commission * (r1.returned_qty * 1.0 / NULLIF(t.range_qty, 0))
                 END
               )
               FROM sale_items si
               JOIN (SELECT product_id, SUM(qty) as returned_qty FROM sales_returns
                     WHERE sale_id = s.id AND (deleted IS NULL OR deleted = 0)
                     GROUP BY product_id) r1 ON r1.product_id = si.product_id
               JOIN (SELECT product_id, SUM(quantity) as range_qty FROM sale_items
                     WHERE sale_id = s.id AND (deleted IS NULL OR deleted = 0)
                     GROUP BY product_id) t ON t.product_id = si.product_id
               WHERE si.sale_id = s.id AND (si.deleted IS NULL OR si.deleted = 0)
             ), 0) as debit,
             0 as credit,
             COALESCE(c.shop_name, c.name) as source,
             'Commission: ' || printf('%.2f', COALESCE(s.total_commission, 0) -
             COALESCE((
               SELECT SUM(
                 CASE WHEN si.commission_rate > 0
                   THEN si.commission_rate * (r1.returned_qty * si.quantity * 1.0 / NULLIF(t.range_qty, 0))
                   ELSE si.commission * (r1.returned_qty * 1.0 / NULLIF(t.range_qty, 0))
                 END
               )
               FROM sale_items si
               JOIN (SELECT product_id, SUM(qty) as returned_qty FROM sales_returns
                     WHERE sale_id = s.id AND (deleted IS NULL OR deleted = 0)
                     GROUP BY product_id) r1 ON r1.product_id = si.product_id
               JOIN (SELECT product_id, SUM(quantity) as range_qty FROM sale_items
                     WHERE sale_id = s.id AND (deleted IS NULL OR deleted = 0)
                     GROUP BY product_id) t ON t.product_id = si.product_id
               WHERE si.sale_id = s.id AND (si.deleted IS NULL OR si.deleted = 0)
             ), 0)) ||
             ' | Per Pack: ' || printf('%.2f', COALESCE((SELECT MAX(commission_rate) FROM sale_items WHERE sale_id = s.id), 0)) ||
             ' | Sale: ' || printf('%.2f', s.total_amount) ||
             ' | Discount: ' || printf('%.2f', COALESCE(s.total_discount, 0)) as notes, NULL as sub_type, 0 as manual
             FROM sales s
             LEFT JOIN salesmen sm ON sm.id = s.salesman_id
             JOIN customers c ON c.id = s.customer_id
             WHERE (s.deleted IS NULL OR s.deleted = 0) AND (COALESCE(s.total_commission, 0) > 0 OR s.salesman_id IS NOT NULL)`;
    }
    sql += dateFilter("s.sale_date", from, to, params);
    sql += ` UNION ALL ${manualEntriesSQL("salesman", subType, from, to, params)}`;
    sql += " ORDER BY date DESC, id DESC";
    return db.prepare(sql).all(...params) as LedgerRow[];
  }

  if (type === "customer") {
    const params: string[] = [];
    let sql = `SELECT s.id, s.sale_date as date, s.invoice_no as ref,
               COALESCE(c.shop_name, c.name) as party,
               s.total_amount as debit,
               s.paid_amount as credit,
               'Sale' as source,
               'Bakaya: ' || printf('%.2f', COALESCE(s.bill_bakaya, 0)) ||
               ' | Disc: ' || printf('%.2f', COALESCE(s.total_discount, 0)) ||
               ' | Empty: ' || printf('%.2f', COALESCE(s.empty_qty, 0)) as notes, NULL as sub_type, 0 as manual
               FROM sales s
               JOIN customers c ON c.id = s.customer_id
               WHERE (s.deleted IS NULL OR s.deleted = 0) AND (c.deleted IS NULL OR c.deleted = 0)
               AND NOT EXISTS (
                 SELECT 1 FROM manual_ledger_entries m
                 WHERE m.ledger_type = 'customer' AND (m.deleted IS NULL OR m.deleted = 0)
                   AND m.source = 'Sale'
                   AND (m.sub_type IS NULL OR m.sub_type = '' OR m.sub_type = 'customer')
                   AND m.ref = COALESCE(s.invoice_no, '#' || s.id)
               )`;
    sql += dateFilter("s.sale_date", from, to, params);
    sql += ` UNION ALL ${manualEntriesSQL("customer", subType, from, to, params)}`;
    sql += " ORDER BY date DESC, id DESC";
    return db.prepare(sql).all(...params) as LedgerRow[];
  }

  // Floor ledger = stock IN/OUT from purchases, sales, transfers, adjustments
  const params: string[] = [];
  const sql = `
    SELECT p.id as id, p.purchase_date as date,
           COALESCE(p.company_name, p.supplier) as party,
           COALESCE(p.invoice_no, 'PUR-' || p.id) as ref,
           0 as debit,
           (SELECT COALESCE(SUM(pi.quantity), 0) FROM purchase_items pi WHERE pi.purchase_id = p.id) as credit,
           'Purchase IN' as source,
           'Stock into warehouse/floor' as notes, NULL as sub_type, 0 as manual
    FROM purchases p
    WHERE (p.deleted IS NULL OR p.deleted = 0)
    ${dateFilter("p.purchase_date", from, to, params)}

    UNION ALL

    SELECT s.id, s.sale_date as date,
           COALESCE(c.shop_name, c.name) as party,
           COALESCE(s.invoice_no, 'SL-' || s.id) as ref,
           (SELECT COALESCE(SUM(si.quantity), 0) FROM sale_items si WHERE si.sale_id = s.id) as debit,
           COALESCE(s.empty_qty, 0) as credit,
           'Sale OUT' as source,
           COALESCE(sm.name, '-') || ' | Empty return: ' || printf('%.2f', COALESCE(s.empty_qty, 0)) as notes, NULL as sub_type, 0 as manual
    FROM sales s
    JOIN customers c ON c.id = s.customer_id
    LEFT JOIN salesmen sm ON sm.id = s.salesman_id
    WHERE (s.deleted IS NULL OR s.deleted = 0)
    ${dateFilter("s.sale_date", from, to, params)}

    UNION ALL

    SELECT st.id, st.transfer_date as date,
           pr.name || ' ' || pr.size as party,
           st.from_location || ' \u2192 ' || st.to_location as ref,
           st.quantity as debit, 0 as credit,
           'Transfer' as source, st.notes, NULL as sub_type, 0 as manual
    FROM stock_transfers st
    JOIN products pr ON pr.id = st.product_id
    WHERE (st.deleted IS NULL OR st.deleted = 0)
    ${dateFilter("st.transfer_date", from, to, params)}

    UNION ALL

    SELECT sa.id, sa.adjust_date as date,
           pr.name || ' ' || pr.size as party,
           COALESCE(sa.reason, 'Adjust') as ref,
           CASE WHEN sa.difference < 0 THEN ABS(sa.difference) ELSE 0 END as debit,
           CASE WHEN sa.difference > 0 THEN sa.difference ELSE 0 END as credit,
           'Adjustment' as source, sa.notes, NULL as sub_type, 0 as manual
    FROM stock_adjustments sa
    JOIN products pr ON pr.id = sa.product_id
    WHERE (sa.deleted IS NULL OR sa.deleted = 0)
    ${dateFilter("sa.adjust_date", from, to, params)}

    UNION ALL ${manualEntriesSQL("floor", subType, from, to, params)}

    ORDER BY date DESC
  `;
  return db.prepare(sql).all(...params) as LedgerRow[];
}
