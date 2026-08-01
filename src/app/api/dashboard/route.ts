import { NextRequest, NextResponse } from "next/server";
import { getDb } from "@/lib/db";
import { seedIfEmpty } from "@/lib/seed";
import { todayLocal } from "@/lib/utils";

export async function GET() {
  try {
    seedIfEmpty();
    const db = getDb();

  const today = todayLocal();

  const stockValue = db
    .prepare("SELECT COALESCE(SUM(stock * purchase_price), 0) as v FROM products WHERE (deleted IS NULL OR deleted = 0)")
    .get() as { v: number };

  const lowStock = db
    .prepare("SELECT COUNT(*) as c FROM products WHERE (deleted IS NULL OR deleted = 0) AND stock <= min_stock")
    .get() as { c: number };

  const todaySales = db
    .prepare("SELECT COALESCE(SUM(total_amount), 0) as v FROM sales WHERE (deleted IS NULL OR deleted = 0) AND sale_date = ? AND COALESCE(is_historical, 0) = 0")
    .get(today) as { v: number };

  const todayPurchase = db
    .prepare("SELECT COALESCE(SUM(total_amount), 0) as v FROM purchases WHERE (deleted IS NULL OR deleted = 0) AND purchase_date = ? AND COALESCE(is_historical, 0) = 0")
    .get(today) as { v: number };

  const customerBalance = db
    .prepare("SELECT COALESCE(SUM(balance), 0) as v FROM customers WHERE (deleted IS NULL OR deleted = 0) AND balance > 0")
    .get() as { v: number };

  const monthSales = db
    .prepare(
      `SELECT COALESCE(SUM(total_amount), 0) as v FROM sales
       WHERE (deleted IS NULL OR deleted = 0) AND strftime('%Y-%m', sale_date) = strftime('%Y-%m', 'now', 'localtime')`
    )
    .get() as { v: number };

  const monthPurchase = db
    .prepare(
      `SELECT COALESCE(SUM(total_amount), 0) as v FROM purchases
       WHERE (deleted IS NULL OR deleted = 0) AND strftime('%Y-%m', purchase_date) = strftime('%Y-%m', 'now', 'localtime')`
    )
    .get() as { v: number };

  const productCount = db.prepare("SELECT COUNT(*) as c FROM products WHERE (deleted IS NULL OR deleted = 0)").get() as { c: number };
  const customerCount = db.prepare("SELECT COUNT(*) as c FROM customers WHERE (deleted IS NULL OR deleted = 0)").get() as { c: number };
  const salesmanCount = db
    .prepare("SELECT COUNT(*) as c FROM salesmen WHERE (deleted IS NULL OR deleted = 0) AND status = 'active'")
    .get() as { c: number };

  const lowStockProducts = db
    .prepare(
      `SELECT id, name, size, stock, min_stock FROM products
       WHERE (deleted IS NULL OR deleted = 0) AND stock <= min_stock ORDER BY stock ASC LIMIT 8`
    )
    .all();

  const recentSales = db
    .prepare(
      `SELECT s.id, s.invoice_no, s.sale_date, s.total_amount, s.paid_amount,
              c.name as customer_name, c.shop_name, sm.name as salesman_name
        FROM sales s
       JOIN customers c ON c.id = s.customer_id
       LEFT JOIN salesmen sm ON sm.id = s.salesman_id
       WHERE (s.deleted IS NULL OR s.deleted = 0)
       ORDER BY s.id DESC LIMIT 8`
    )
    .all();

  const recentPurchases = db
    .prepare(
      `SELECT id, invoice_no, supplier, purchase_date, total_amount, paid_amount
       FROM purchases WHERE (deleted IS NULL OR deleted = 0) ORDER BY id DESC LIMIT 5`
    )
    .all();

  return NextResponse.json({
    stockValue: stockValue.v,
    lowStock: lowStock.c,
    todaySales: todaySales.v,
    todayPurchase: todayPurchase.v,
    customerBalance: customerBalance.v,
    monthSales: monthSales.v,
    monthPurchase: monthPurchase.v,
    productCount: productCount.c,
    customerCount: customerCount.c,
    salesmanCount: salesmanCount.c,
    profit: monthSales.v - monthPurchase.v,
    lowStockProducts,
    recentSales,
    recentPurchases,
  });
  } catch (e) {
    console.error("dashboard error", e);
    return NextResponse.json(
      { error: e instanceof Error ? e.message : "Dashboard failed" },
      { status: 500 }
    );
  }
}

export async function POST(_req: NextRequest) {
  return NextResponse.json({ ok: true });
}
