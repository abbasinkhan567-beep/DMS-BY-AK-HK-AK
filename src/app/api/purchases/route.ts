import { NextRequest, NextResponse } from "next/server";
import { getDb } from "@/lib/db";

export async function GET(req: NextRequest) {
  const db = getDb();
  const id = new URL(req.url).searchParams.get("id");

  if (id) {
    const purchase = db.prepare("SELECT * FROM purchases WHERE id = ?").get(id);
    if (!purchase) return NextResponse.json({ error: "Not found" }, { status: 404 });
    const items = db
      .prepare(
        `SELECT pi.*, p.name as linked_name, p.size as linked_size
         FROM purchase_items pi LEFT JOIN products p ON p.id = pi.product_id
         WHERE pi.purchase_id = ?`
      )
      .all(id);
    return NextResponse.json({ ...purchase, items });
  }

  const purchases = db
    .prepare(
      `SELECT p.*,
        (SELECT COUNT(*) FROM purchase_items pi WHERE pi.purchase_id = p.id) as item_count
       FROM purchases p ORDER BY p.id DESC`
    )
    .all();
  return NextResponse.json(purchases);
}

type PurchaseItemInput = {
  product_id: number;
  product_name?: string;
  company_name?: string;
  size?: string;
  quantity: number;
  hand_to_hand?: number;
  conditional?: number;
  rate_per_cotton?: number;
  unit_price?: number;
  total_rate?: number;
};

function calcItemTotal(item: PurchaseItemInput) {
  const qty = Number(item.quantity) || 0;
  const rate = Number(item.rate_per_cotton ?? item.unit_price) || 0;
  const totalRate = Number(item.total_rate) || qty * rate;
  return { qty, rate, totalRate };
}

export async function POST(req: NextRequest) {
  const body = await req.json();
  const {
    invoice_no,
    supplier = "Pepsi Company",
    company_name,
    purchase_date,
    paid_amount = 0,
    notes,
    items = [],
    expense1_label,
    expense1_amount = 0,
    expense2_label,
    expense2_amount = 0,
    expense3_label,
    expense3_amount = 0,
    historical = false,
    is_historical = 0,
  } = body as {
    invoice_no?: string;
    supplier?: string;
    company_name?: string;
    purchase_date?: string;
    paid_amount?: number;
    notes?: string;
    items: PurchaseItemInput[];
    expense1_label?: string;
    expense1_amount?: number;
    expense2_label?: string;
    expense2_amount?: number;
    expense3_label?: string;
    expense3_amount?: number;
    historical?: boolean;
    is_historical?: number | boolean;
  };

  const isHistorical = Boolean(historical || is_historical);

  if (!items.length) {
    return NextResponse.json({ error: "At least one item required" }, { status: 400 });
  }

  const db = getDb();
  const total_amount = items.reduce((sum, item) => sum + calcItemTotal(item).totalRate, 0);
  const total_expense =
    (Number(expense1_amount) || 0) + (Number(expense2_amount) || 0) + (Number(expense3_amount) || 0);

  const tx = db.transaction(() => {
    const result = db
      .prepare(
        `INSERT INTO purchases (
          invoice_no, supplier, company_name, purchase_date, total_amount, paid_amount, notes,
          expense1_label, expense1_amount, expense2_label, expense2_amount, expense3_label, expense3_amount, total_expense,
          is_historical
        ) VALUES (?, ?, ?, ?, ?, ?, ?, ?, ?, ?, ?, ?, ?, ?, ?)`
      )
      .run(
        invoice_no || null,
        supplier,
        company_name || supplier,
        purchase_date || new Date().toISOString().slice(0, 10),
        total_amount,
        paid_amount,
        notes || null,
        expense1_label || null,
        expense1_amount || 0,
        expense2_label || null,
        expense2_amount || 0,
        expense3_label || null,
        expense3_amount || 0,
        total_expense,
        isHistorical ? 1 : 0
      );

    const purchaseId = result.lastInsertRowid;
    const insertItem = db.prepare(
      `INSERT INTO purchase_items
       (purchase_id, product_id, product_name, company_name, size, quantity, hand_to_hand, conditional, rate_per_cotton, unit_price, total_rate, total)
       VALUES (?, ?, ?, ?, ?, ?, ?, ?, ?, ?, ?, ?)`
    );
    const updateStock = db.prepare(
      `UPDATE products SET stock = stock + ?, purchase_price = CASE WHEN ? > 0 THEN ? ELSE purchase_price END WHERE id = ?`
    );

    for (const item of items) {
      const product = db.prepare("SELECT name, size FROM products WHERE id = ?").get(item.product_id) as
        | { name: string; size: string }
        | undefined;
      const { qty, rate, totalRate } = calcItemTotal(item);
      insertItem.run(
        purchaseId,
        item.product_id,
        item.product_name || product?.name || "",
        item.company_name || company_name || supplier,
        item.size || product?.size || "",
        qty,
        item.hand_to_hand || 0,
        item.conditional || 0,
        rate,
        rate,
        totalRate,
        totalRate
      );
      if (!isHistorical) {
        updateStock.run(qty, rate, rate, item.product_id);
      }
    }

    return purchaseId;
  });

  const purchaseId = tx();
  return NextResponse.json(db.prepare("SELECT * FROM purchases WHERE id = ?").get(purchaseId), {
    status: 201,
  });
}

export async function PUT(req: NextRequest) {
  const body = await req.json();
  const {
    id,
    invoice_no,
    supplier,
    company_name,
    purchase_date,
    paid_amount,
    notes,
    items,
    expense1_label,
    expense1_amount = 0,
    expense2_label,
    expense2_amount = 0,
    expense3_label,
    expense3_amount = 0,
  } = body;
  if (!id) return NextResponse.json({ error: "ID required" }, { status: 400 });
  if (!items?.length) return NextResponse.json({ error: "Items required" }, { status: 400 });

  const db = getDb();
  const total_expense =
    (Number(expense1_amount) || 0) + (Number(expense2_amount) || 0) + (Number(expense3_amount) || 0);

  try {
    const tx = db.transaction(() => {
      const oldItems = db
        .prepare("SELECT product_id, quantity FROM purchase_items WHERE purchase_id = ?")
        .all(id) as Array<{ product_id: number; quantity: number }>;
      for (const item of oldItems) {
        db.prepare(
          "UPDATE products SET stock = CASE WHEN stock >= ? THEN stock - ? ELSE 0 END WHERE id = ?"
        ).run(item.quantity, item.quantity, item.product_id);
      }
      db.prepare("DELETE FROM purchase_items WHERE purchase_id = ?").run(id);

      const total_amount = items.reduce(
        (sum: number, item: PurchaseItemInput) => sum + calcItemTotal(item).totalRate,
        0
      );

      db.prepare(
        `UPDATE purchases SET invoice_no=?, supplier=?, company_name=?, purchase_date=?, total_amount=?, paid_amount=?, notes=?,
         expense1_label=?, expense1_amount=?, expense2_label=?, expense2_amount=?, expense3_label=?, expense3_amount=?, total_expense=?
         WHERE id=?`
      ).run(
        invoice_no || null,
        supplier,
        company_name || supplier,
        purchase_date,
        total_amount,
        paid_amount || 0,
        notes || null,
        expense1_label || null,
        expense1_amount || 0,
        expense2_label || null,
        expense2_amount || 0,
        expense3_label || null,
        expense3_amount || 0,
        total_expense,
        id
      );

      const insertItem = db.prepare(
        `INSERT INTO purchase_items
         (purchase_id, product_id, product_name, company_name, size, quantity, hand_to_hand, conditional, rate_per_cotton, unit_price, total_rate, total)
         VALUES (?, ?, ?, ?, ?, ?, ?, ?, ?, ?, ?, ?)`
      );
      const updateStock = db.prepare(
        `UPDATE products SET stock = stock + ?, purchase_price = CASE WHEN ? > 0 THEN ? ELSE purchase_price END WHERE id = ?`
      );

      for (const item of items as PurchaseItemInput[]) {
        const product = db.prepare("SELECT name, size FROM products WHERE id = ?").get(item.product_id) as
          | { name: string; size: string }
          | undefined;
        const { qty, rate, totalRate } = calcItemTotal(item);
        insertItem.run(
          id,
          item.product_id,
          item.product_name || product?.name || "",
          item.company_name || company_name || supplier,
          item.size || product?.size || "",
          qty,
          item.hand_to_hand || 0,
          item.conditional || 0,
          rate,
          rate,
          totalRate,
          totalRate
        );
        updateStock.run(qty, rate, rate, item.product_id);
      }
    });
    tx();
    return NextResponse.json(db.prepare("SELECT * FROM purchases WHERE id = ?").get(id));
  } catch (e) {
    return NextResponse.json({ error: String(e) }, { status: 500 });
  }
}

export async function DELETE(req: NextRequest) {
  const id = new URL(req.url).searchParams.get("id");
  if (!id) return NextResponse.json({ error: "ID required" }, { status: 400 });

  const db = getDb();
  try {
    const tx = db.transaction(() => {
      const items = db
        .prepare("SELECT product_id, quantity FROM purchase_items WHERE purchase_id = ?")
        .all(id) as Array<{ product_id: number; quantity: number }>;
      for (const item of items) {
        db.prepare(
          "UPDATE products SET stock = CASE WHEN stock >= ? THEN stock - ? ELSE 0 END WHERE id = ?"
        ).run(item.quantity, item.quantity, item.product_id);
      }
      db.prepare("DELETE FROM purchase_items WHERE purchase_id = ?").run(id);
      db.prepare("DELETE FROM purchases WHERE id = ?").run(id);
    });
    tx();
    return NextResponse.json({ ok: true });
  } catch (e) {
    return NextResponse.json({ error: String(e) }, { status: 500 });
  }
}
