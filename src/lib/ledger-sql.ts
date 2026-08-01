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
  let sql = `SELECT id, entry_date as date, ref, party, debit, credit, source, notes, sub_type, 1 as manual
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
