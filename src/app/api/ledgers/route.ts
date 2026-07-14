import { NextRequest, NextResponse } from "next/server";
import { getDb } from "@/lib/db";

function dateFilter(
  column: string,
  from: string | null,
  to: string | null,
  params: string[]
) {
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

export async function GET(req: NextRequest) {
  const type = new URL(req.url).searchParams.get("type") || "company";
  const db = getDb();
  const from = new URL(req.url).searchParams.get("from");
  const to = new URL(req.url).searchParams.get("to");

  if (type === "company") {
    const params: string[] = [];
    let sql = `SELECT id, purchase_date as date, invoice_no as ref, COALESCE(company_name, supplier) as party,
               total_amount as debit, paid_amount as credit, 'Purchase' as source,
               CAST(COALESCE(total_expense, 0) as TEXT) as notes
               FROM purchases WHERE 1=1`;
    sql += dateFilter("purchase_date", from, to, params);
    sql += " ORDER BY purchase_date DESC, id DESC";
    return NextResponse.json({ type, rows: db.prepare(sql).all(...params) });
  }

  if (type === "expense") {
    // All expense sources: manual + sale bill expense + discount + purchase expense
    const params: string[] = [];
    let sql = `
      SELECT id, expense_date as date, category as ref, title as party,
             amount as debit, 0 as credit, paid_from as source, notes
      FROM expenses WHERE 1=1
      ${dateFilter("expense_date", from, to, params)}
      UNION ALL
      SELECT s.id, s.sale_date as date, 'Sale Bill Expense' as ref,
             COALESCE(c.shop_name, c.name) as party,
             s.total_bill_expense as debit, 0 as credit, 'Sale' as source,
             COALESCE(s.invoice_no, '#' || s.id) as notes
      FROM sales s
      JOIN customers c ON c.id = s.customer_id
      WHERE s.total_bill_expense > 0
      ${dateFilter("s.sale_date", from, to, params)}
      UNION ALL
      SELECT s.id, s.sale_date as date, 'Discount' as ref,
             COALESCE(c.shop_name, c.name) as party,
             s.total_discount as debit, 0 as credit, 'Sale Discount' as source,
             COALESCE(s.invoice_no, '#' || s.id) as notes
      FROM sales s
      JOIN customers c ON c.id = s.customer_id
      WHERE s.total_discount > 0
      ${dateFilter("s.sale_date", from, to, params)}
      UNION ALL
      SELECT p.id, p.purchase_date as date, 'Purchase Expense' as ref,
             COALESCE(p.company_name, p.supplier) as party,
             p.total_expense as debit, 0 as credit, 'Purchase' as source,
             COALESCE(p.invoice_no, '#' || p.id) as notes
      FROM purchases p
      WHERE COALESCE(p.total_expense, 0) > 0
      ${dateFilter("p.purchase_date", from, to, params)}
      ORDER BY date DESC
    `;
    return NextResponse.json({ type, rows: db.prepare(sql).all(...params) });
  }

  if (type === "salesman") {
    // Commission-focused salesman ledger
    const params: string[] = [];
    let sql = `SELECT s.id, s.sale_date as date, s.invoice_no as ref,
               COALESCE(sm.name, 'No Salesman') as party,
               COALESCE(s.total_commission, 0) as debit,
               0 as credit,
               COALESCE(c.shop_name, c.name) as source,
               'Commission: ' || printf('%.0f', COALESCE(s.total_commission, 0)) ||
               ' | Sale: ' || printf('%.0f', s.total_amount) ||
               ' | Discount: ' || printf('%.0f', COALESCE(s.total_discount, 0)) as notes
               FROM sales s
               LEFT JOIN salesmen sm ON sm.id = s.salesman_id
               JOIN customers c ON c.id = s.customer_id
               WHERE COALESCE(s.total_commission, 0) > 0 OR s.salesman_id IS NOT NULL`;
    sql += dateFilter("s.sale_date", from, to, params);
    sql += " ORDER BY s.sale_date DESC, s.id DESC";
    return NextResponse.json({
      type,
      rows: db.prepare(sql).all(...params),
      columns: {
        debit: "Commission",
        credit: "Paid",
        notes: "Details",
      },
    });
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
           'Stock into warehouse/floor' as notes
    FROM purchases p
    WHERE 1=1
    ${dateFilter("p.purchase_date", from, to, params)}

    UNION ALL

    SELECT s.id, s.sale_date as date,
           COALESCE(c.shop_name, c.name) as party,
           COALESCE(s.invoice_no, 'SL-' || s.id) as ref,
           (SELECT COALESCE(SUM(si.quantity), 0) FROM sale_items si WHERE si.sale_id = s.id) as debit,
           COALESCE(s.empty_qty, 0) as credit,
           'Sale OUT' as source,
           COALESCE(sm.name, '-') || ' | Empty return: ' || printf('%.0f', COALESCE(s.empty_qty, 0)) as notes
    FROM sales s
    JOIN customers c ON c.id = s.customer_id
    LEFT JOIN salesmen sm ON sm.id = s.salesman_id
    WHERE 1=1
    ${dateFilter("s.sale_date", from, to, params)}

    UNION ALL

    SELECT st.id, st.transfer_date as date,
           pr.name || ' ' || pr.size as party,
           st.from_location || ' → ' || st.to_location as ref,
           st.quantity as debit, 0 as credit,
           'Transfer' as source, st.notes
    FROM stock_transfers st
    JOIN products pr ON pr.id = st.product_id
    WHERE 1=1
    ${dateFilter("st.transfer_date", from, to, params)}

    UNION ALL

    SELECT sa.id, sa.adjust_date as date,
           pr.name || ' ' || pr.size as party,
           COALESCE(sa.reason, 'Adjust') as ref,
           CASE WHEN sa.difference < 0 THEN ABS(sa.difference) ELSE 0 END as debit,
           CASE WHEN sa.difference > 0 THEN sa.difference ELSE 0 END as credit,
           'Adjustment' as source, sa.notes
    FROM stock_adjustments sa
    JOIN products pr ON pr.id = sa.product_id
    WHERE 1=1
    ${dateFilter("sa.adjust_date", from, to, params)}

    ORDER BY date DESC
  `;

  return NextResponse.json({
    type: "floor",
    rows: db.prepare(sql).all(...params),
    columns: {
      debit: "Qty OUT",
      credit: "Qty IN",
      notes: "Details",
    },
  });
}
