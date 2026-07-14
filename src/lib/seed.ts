import { getDb } from "./db";

export function seedIfEmpty() {
  const db = getDb();
  const count = db.prepare("SELECT COUNT(*) as c FROM products").get() as { c: number };
  if (count.c > 0) return;

  const insertProduct = db.prepare(`
    INSERT INTO products (name, size, unit, purchase_price, sale_price, stock, min_stock)
    VALUES (?, ?, ?, ?, ?, ?, ?)
  `);

  const products = [
    ["Pepsi", "1.5L", "bottle", 180, 210, 0, 20],
    ["Pepsi", "1L", "bottle", 130, 155, 0, 20],
    ["Pepsi", "500ml", "bottle", 70, 90, 0, 40],
    ["Pepsi", "250ml", "bottle", 40, 55, 0, 50],
    ["Mirinda Orange", "1.5L", "bottle", 180, 210, 0, 15],
    ["Mirinda Orange", "500ml", "bottle", 70, 90, 0, 30],
    ["7UP", "1.5L", "bottle", 180, 210, 0, 15],
    ["7UP", "500ml", "bottle", 70, 90, 0, 30],
    ["Mountain Dew", "1.5L", "bottle", 185, 215, 0, 15],
    ["Mountain Dew", "500ml", "bottle", 75, 95, 0, 30],
    ["Aquafina", "1.5L", "bottle", 60, 80, 0, 40],
    ["Sting", "300ml", "bottle", 55, 70, 0, 40],
  ];

  const tx = db.transaction(() => {
    for (const p of products) {
      insertProduct.run(...p);
    }

    db.prepare(`
      INSERT INTO salesmen (name, phone, area, salary, status)
      VALUES (?, ?, ?, ?, ?)
    `).run("Ahmed Khan", "0300-1234567", "Gulshan", 25000, "active");

    db.prepare(`
      INSERT INTO salesmen (name, phone, area, salary, status)
      VALUES (?, ?, ?, ?, ?)
    `).run("Bilal Ali", "0321-9876543", "Nazimabad", 22000, "active");

    db.prepare(`
      INSERT INTO customers (name, shop_name, phone, address, area, balance)
      VALUES (?, ?, ?, ?, ?, ?)
    `).run("Rashid", "Rashid General Store", "0312-1112233", "Shop 12, Main Bazar", "Gulshan", 0);

    db.prepare(`
      INSERT INTO customers (name, shop_name, phone, address, area, balance)
      VALUES (?, ?, ?, ?, ?, ?)
    `).run("Imran", "Imran Cold Corner", "0333-4455667", "Near Bus Stop", "Nazimabad", 0);
  });

  tx();
}
