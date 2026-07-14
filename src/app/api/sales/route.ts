import { NextRequest, NextResponse } from "next/server";
import { getDb } from "@/lib/db";

export async function GET(req: NextRequest) {
  const db = getDb();
  const id = new URL(req.url).searchParams.get("id");

  if (id) {
    const sale = db
      .prepare(
        `SELECT s.*, c.name as customer_name, c.shop_name, c.phone as customer_phone,
                sm.name as salesman_name
         FROM sales s
         JOIN customers c ON c.id = s.customer_id
         LEFT JOIN salesmen sm ON sm.id = s.salesman_id
         WHERE s.id = ?`
      )
      .get(id);
    if (!sale) return NextResponse.json({ error: "Not found" }, { status: 404 });
    const items = db
      .prepare(
        `SELECT si.*, p.name as linked_name, p.size as linked_size
         FROM sale_items si LEFT JOIN products p ON p.id = si.product_id
         WHERE si.sale_id = ?`
      )
      .all(id);
    return NextResponse.json({ ...sale, items });
  }

  const sales = db
    .prepare(
      `SELECT s.*,
              c.name as customer_name, c.shop_name, sm.name as salesman_name,
              (SELECT COUNT(*) FROM sale_items si WHERE si.sale_id = s.id) as item_count
       FROM sales s
       JOIN customers c ON c.id = s.customer_id
       LEFT JOIN salesmen sm ON sm.id = s.salesman_id
       ORDER BY s.id DESC`
    )
    .all();
  return NextResponse.json(sales);
}

type SaleItemInput = {
  product_id: number;
  product_name?: string;
  quantity: number;
  unit_price: number;
  commission?: number;
  discount?: number;
  commission_rate?: number;
  discount_rate?: number;
};

function lineCommission(item: SaleItemInput) {
  const rate = Number(item.commission_rate);
  if (rate > 0) return rate * (Number(item.quantity) || 0);
  return Number(item.commission) || 0;
}

function lineDiscount(item: SaleItemInput) {
  const rate = Number(item.discount_rate);
  if (rate > 0) return rate * (Number(item.quantity) || 0);
  return Number(item.discount) || 0;
}

export async function POST(req: NextRequest) {
  const body = await req.json();
  const {
    invoice_no,
    customer_id,
    salesman_id,
    sale_date,
    paid_amount = 0,
    payment_type = "cash",
    bill_bakaya,
    empty_qty = 0,
    bank_account,
    expense1_label,
    expense1_amount = 0,
    expense2_label,
    expense2_amount = 0,
    expense3_label,
    expense3_amount = 0,
    notes,
    items = [],
    historical = false,
    is_historical = 0,
  } = body;

  const isHistorical = Boolean(historical || is_historical);

  if (!customer_id) return NextResponse.json({ error: "Customer required" }, { status: 400 });
  if (!items.length) return NextResponse.json({ error: "At least one item required" }, { status: 400 });

  const db = getDb();

  for (const item of items as SaleItemInput[]) {
    const product = db.prepare("SELECT stock, name, size FROM products WHERE id = ?").get(item.product_id) as
      | { stock: number; name: string; size: string }
      | undefined;
    if (!product) return NextResponse.json({ error: "Product not found" }, { status: 400 });
    if (!isHistorical && product.stock < item.quantity) {
      return NextResponse.json(
        { error: `Insufficient stock: ${product.name} ${product.size} (available: ${product.stock})` },
        { status: 400 }
      );
    }
  }

  const itemsSubtotal = (items as SaleItemInput[]).reduce(
    (sum, item) => sum + item.quantity * item.unit_price,
    0
  );
  const total_commission = (items as SaleItemInput[]).reduce(
    (sum, item) => sum + lineCommission(item),
    0
  );
  const total_discount = (items as SaleItemInput[]).reduce(
    (sum, item) => sum + lineDiscount(item),
    0
  );
  const total_bill_expense =
    (Number(expense1_amount) || 0) + (Number(expense2_amount) || 0) + (Number(expense3_amount) || 0);
  const total_amount = itemsSubtotal - total_discount + total_bill_expense;
  const paid = Number(paid_amount) || 0;
  const bakaya =
    bill_bakaya !== undefined && bill_bakaya !== null
      ? Number(bill_bakaya)
      : Math.max(0, total_amount - paid);

  try {
    const tx = db.transaction(() => {
      const result = db
        .prepare(
          `INSERT INTO sales (
            invoice_no, customer_id, salesman_id, sale_date, total_amount, paid_amount, payment_type,
            bill_bakaya, empty_qty, bank_account,
            expense1_label, expense1_amount, expense2_label, expense2_amount, expense3_label, expense3_amount,
            total_commission, total_discount, total_bill_expense, notes, is_historical
          ) VALUES (?, ?, ?, ?, ?, ?, ?, ?, ?, ?, ?, ?, ?, ?, ?, ?, ?, ?, ?, ?, ?)`
        )
        .run(
          invoice_no || null,
          customer_id,
          salesman_id || null,
          sale_date || new Date().toISOString().slice(0, 10),
          total_amount,
          paid,
          payment_type,
          bakaya,
          empty_qty || 0,
          bank_account || null,
          expense1_label || null,
          expense1_amount || 0,
          expense2_label || null,
          expense2_amount || 0,
          expense3_label || null,
          expense3_amount || 0,
          total_commission,
          total_discount,
          total_bill_expense,
          notes || null,
          isHistorical ? 1 : 0
        );

      const saleId = result.lastInsertRowid;
      const insertItem = db.prepare(
        `INSERT INTO sale_items (sale_id, product_id, product_name, quantity, unit_price, commission, discount, commission_rate, discount_rate, total)
         VALUES (?, ?, ?, ?, ?, ?, ?, ?, ?, ?)`
      );
      const updateStock = db.prepare("UPDATE products SET stock = stock - ? WHERE id = ?");

      for (const item of items as SaleItemInput[]) {
        const product = db.prepare("SELECT name FROM products WHERE id = ?").get(item.product_id) as {
          name: string;
        };
        const disc = lineDiscount(item);
        const comm = lineCommission(item);
        const lineTotal = item.quantity * item.unit_price - disc;
        insertItem.run(
          saleId,
          item.product_id,
          item.product_name || product.name,
          item.quantity,
          item.unit_price,
          comm,
          disc,
          item.commission_rate || 0,
          item.discount_rate || 0,
          lineTotal
        );
        if (!isHistorical) {
          updateStock.run(item.quantity, item.product_id);
        }
      }

      if (bakaya !== 0) {
        db.prepare("UPDATE customers SET balance = balance + ? WHERE id = ?").run(bakaya, customer_id);
      }

      return saleId;
    });

    const saleId = tx();
    return NextResponse.json(
      db
        .prepare(
          `SELECT s.*, c.name as customer_name, sm.name as salesman_name
           FROM sales s JOIN customers c ON c.id = s.customer_id
           LEFT JOIN salesmen sm ON sm.id = s.salesman_id WHERE s.id = ?`
        )
        .get(saleId),
      { status: 201 }
    );
  } catch (e) {
    return NextResponse.json({ error: String(e) }, { status: 500 });
  }
}

export async function PUT(req: NextRequest) {
  const body = await req.json();
  const { id, items } = body;
  if (!id) return NextResponse.json({ error: "ID required" }, { status: 400 });
  if (!items?.length) return NextResponse.json({ error: "Items required" }, { status: 400 });

  const db = getDb();
  try {
    const tx = db.transaction(() => {
      const old = db.prepare("SELECT * FROM sales WHERE id = ?").get(id) as
        | {
            customer_id: number;
            bill_bakaya: number;
            total_amount: number;
            paid_amount: number;
          }
        | undefined;
      if (!old) throw new Error("Sale not found");

      const oldItems = db
        .prepare("SELECT product_id, quantity FROM sale_items WHERE sale_id = ?")
        .all(id) as Array<{ product_id: number; quantity: number }>;
      for (const item of oldItems) {
        db.prepare("UPDATE products SET stock = stock + ? WHERE id = ?").run(item.quantity, item.product_id);
      }
      if (old.bill_bakaya) {
        db.prepare("UPDATE customers SET balance = balance - ? WHERE id = ?").run(
          old.bill_bakaya,
          old.customer_id
        );
      }
      db.prepare("DELETE FROM sale_items WHERE sale_id = ?").run(id);

      for (const item of items) {
        const product = db.prepare("SELECT stock, name FROM products WHERE id = ?").get(item.product_id) as
          | { stock: number; name: string }
          | undefined;
        if (!product) throw new Error("Product not found");
        if (product.stock < item.quantity) {
          throw new Error(`Insufficient stock: ${product.name}`);
        }
      }

      const {
        invoice_no,
        customer_id,
        salesman_id,
        sale_date,
        paid_amount = 0,
        payment_type = "cash",
        bill_bakaya,
        empty_qty = 0,
        bank_account,
        expense1_label,
        expense1_amount = 0,
        expense2_label,
        expense2_amount = 0,
        expense3_label,
        expense3_amount = 0,
        notes,
      } = body;

      const itemsSubtotal = items.reduce(
        (sum: number, item: SaleItemInput) => sum + item.quantity * item.unit_price,
        0
      );
      const total_commission = items.reduce(
        (sum: number, item: SaleItemInput) => sum + lineCommission(item),
        0
      );
      const total_discount = items.reduce(
        (sum: number, item: SaleItemInput) => sum + lineDiscount(item),
        0
      );
      const total_bill_expense =
        (Number(expense1_amount) || 0) + (Number(expense2_amount) || 0) + (Number(expense3_amount) || 0);
      const total_amount = itemsSubtotal - total_discount + total_bill_expense;
      const paid = Number(paid_amount) || 0;
      const bakaya =
        bill_bakaya !== undefined && bill_bakaya !== null
          ? Number(bill_bakaya)
          : Math.max(0, total_amount - paid);

      db.prepare(
        `UPDATE sales SET invoice_no=?, customer_id=?, salesman_id=?, sale_date=?, total_amount=?, paid_amount=?,
         payment_type=?, bill_bakaya=?, empty_qty=?, bank_account=?,
         expense1_label=?, expense1_amount=?, expense2_label=?, expense2_amount=?, expense3_label=?, expense3_amount=?,
         total_commission=?, total_discount=?, total_bill_expense=?, notes=?
         WHERE id=?`
      ).run(
        invoice_no || null,
        customer_id,
        salesman_id || null,
        sale_date,
        total_amount,
        paid,
        payment_type,
        bakaya,
        empty_qty || 0,
        bank_account || null,
        expense1_label || null,
        expense1_amount || 0,
        expense2_label || null,
        expense2_amount || 0,
        expense3_label || null,
        expense3_amount || 0,
        total_commission,
        total_discount,
        total_bill_expense,
        notes || null,
        id
      );

      const insertItem = db.prepare(
        `INSERT INTO sale_items (sale_id, product_id, product_name, quantity, unit_price, commission, discount, commission_rate, discount_rate, total)
         VALUES (?, ?, ?, ?, ?, ?, ?, ?, ?, ?)`
      );
      for (const item of items as SaleItemInput[]) {
        const product = db.prepare("SELECT name FROM products WHERE id = ?").get(item.product_id) as {
          name: string;
        };
        const disc = lineDiscount(item);
        const comm = lineCommission(item);
        const lineTotal = item.quantity * item.unit_price - disc;
        insertItem.run(
          id,
          item.product_id,
          item.product_name || product.name,
          item.quantity,
          item.unit_price,
          comm,
          disc,
          item.commission_rate || 0,
          item.discount_rate || 0,
          lineTotal
        );
        db.prepare("UPDATE products SET stock = stock - ? WHERE id = ?").run(item.quantity, item.product_id);
      }

      if (bakaya !== 0) {
        db.prepare("UPDATE customers SET balance = balance + ? WHERE id = ?").run(bakaya, customer_id);
      }
    });
    tx();
    return NextResponse.json(db.prepare("SELECT * FROM sales WHERE id = ?").get(id));
  } catch (e) {
    return NextResponse.json({ error: String(e) }, { status: 400 });
  }
}

export async function DELETE(req: NextRequest) {
  const id = new URL(req.url).searchParams.get("id");
  if (!id) return NextResponse.json({ error: "ID required" }, { status: 400 });

  const db = getDb();
  try {
    const tx = db.transaction(() => {
      const sale = db.prepare("SELECT * FROM sales WHERE id = ?").get(id) as
        | { customer_id: number; bill_bakaya: number; total_amount: number; paid_amount: number }
        | undefined;
      if (!sale) throw new Error("Sale not found");

      const items = db
        .prepare("SELECT product_id, quantity FROM sale_items WHERE sale_id = ?")
        .all(id) as Array<{ product_id: number; quantity: number }>;
      for (const item of items) {
        db.prepare("UPDATE products SET stock = stock + ? WHERE id = ?").run(item.quantity, item.product_id);
      }

      const due = sale.bill_bakaya ?? sale.total_amount - sale.paid_amount;
      if (due !== 0) {
        db.prepare("UPDATE customers SET balance = balance - ? WHERE id = ?").run(due, sale.customer_id);
      }

      db.prepare("DELETE FROM sale_items WHERE sale_id = ?").run(id);
      db.prepare("DELETE FROM sales WHERE id = ?").run(id);
    });
    tx();
    return NextResponse.json({ ok: true });
  } catch (e) {
    return NextResponse.json({ error: String(e) }, { status: 500 });
  }
}
