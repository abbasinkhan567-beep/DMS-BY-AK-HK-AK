import { NextRequest, NextResponse } from "next/server";
import { getDb } from "@/lib/db";
import { seedIfEmpty } from "@/lib/seed";

export async function GET() {
  seedIfEmpty();
  const db = getDb();

  const today = new Date().toISOString().slice(0, 10);

  const stockValue = db
    .prepare("SELECT COALESCE(SUM(stock * purchase_price), 0) as v FROM products")
    .get() as { v: number };

  const lowStock = db
    .prepare("SELECT COUNT(*) as c FROM products WHERE stock <= min_stock")
    .get() as { c: number };

  const todaySales = db
    .prepare("SELECT COALESCE(SUM(total_amount), 0) as v FROM sales WHERE sale_date = ?")
    .get(today) as { v: number };

  const todayPurchase = db
    .prepare("SELECT COALESCE(SUM(total_amount), 0) as v FROM purchases WHERE purchase_date = ?")
    .get(today) as { v: number };

  const customerBalance = db
    .prepare("SELECT COALESCE(SUM(balance), 0) as v FROM customers WHERE balance > 0")
    .get() as { v: number };

  const monthSales = db
    .prepare(
      `SELECT COALESCE(SUM(total_amount), 0) as v FROM sales
       WHERE strftime('%Y-%m', sale_date) = strftime('%Y-%m', 'now', 'localtime')`
    )
    .get() as { v: number };

  const monthPurchase = db
    .prepare(
      `SELECT COALESCE(SUM(total_amount), 0) as v FROM purchases
       WHERE strftime('%Y-%m', purchase_date) = strftime('%Y-%m', 'now', 'localtime')`
    )
    .get() as { v: number };

  const productCount = db.prepare("SELECT COUNT(*) as c FROM products").get() as { c: number };
  const customerCount = db.prepare("SELECT COUNT(*) as c FROM customers").get() as { c: number };
  const salesmanCount = db
    .prepare("SELECT COUNT(*) as c FROM salesmen WHERE status = 'active'")
    .get() as { c: number };

  const lowStockProducts = db
    .prepare(
      `SELECT id, name, size, stock, min_stock FROM products
       WHERE stock <= min_stock ORDER BY stock ASC LIMIT 8`
    )
    .all();

  const recentSales = db
    .prepare(
      `SELECT s.id, s.invoice_no, s.sale_date, s.total_amount, s.paid_amount,
              c.name as customer_name, c.shop_name, sm.name as salesman_name
       FROM sales s
       JOIN customers c ON c.id = s.customer_id
       LEFT JOIN salesmen sm ON sm.id = s.salesman_id
       ORDER BY s.id DESC LIMIT 8`
    )
    .all();

  const recentPurchases = db
    .prepare(
      `SELECT id, invoice_no, supplier, purchase_date, total_amount, paid_amount
       FROM purchases ORDER BY id DESC LIMIT 5`
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
}

export async function POST(_req: NextRequest) {
  return NextResponse.json({ ok: true });
}
