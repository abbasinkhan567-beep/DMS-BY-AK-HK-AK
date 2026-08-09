import { getLedgerSubTypeFilter } from "@/lib/ledger-categories";

/**
 * Builds the manual_ledger_entries SELECT for a ledger.
 * NOTE: never append ORDER BY here - every caller adds its own ORDER BY
 * at the end of the compound SELECT (a second ORDER BY is a syntax error).
 */
export function manualEntriesSQL(
  type: string,
  subType: string,
  from: string | null,
  to: string | null,
  params: string[]
) {
  const filter = getLedgerSubTypeFilter(type, subType);
  let sql = `SELECT id, entry_date as date, ref, party,
             CASE WHEN source = 'Sale' AND ledger_type = 'customer'
               THEN debit - COALESCE((
                 SELECT SUM(sr.qty * sr.rate) FROM sales_returns sr
                 JOIN sales s ON s.id = sr.sale_id
                 WHERE s.invoice_no = manual_ledger_entries.ref
                   AND (sr.deleted IS NULL OR sr.deleted = 0) AND (s.deleted IS NULL OR s.deleted = 0)
               ), 0)
             WHEN source = 'Purchase' AND ledger_type = 'company'
               THEN debit - COALESCE((
                 SELECT SUM(pr.qty * pr.rate) FROM purchase_returns pr
                 JOIN purchases p ON p.id = pr.purchase_id
                 WHERE p.invoice_no = manual_ledger_entries.ref
                   AND (pr.deleted IS NULL OR pr.deleted = 0) AND (p.deleted IS NULL OR p.deleted = 0)
               ), 0)
             ELSE debit END as debit,
             credit, source, notes, sub_type, 1 as manual
             FROM manual_ledger_entries
             WHERE ledger_type = ? AND (deleted IS NULL OR deleted = 0) AND ${filter.clause}`;
  params.push(type, filter.param);
  if (from) {
    sql += " AND entry_date >= ?";
    params.push(from);
  }
  if (to) {
    sql += " AND entry_date <= ?";
    params.push(to);
  }
  return sql;
}
