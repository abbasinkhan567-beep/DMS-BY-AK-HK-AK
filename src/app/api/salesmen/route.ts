import { NextRequest, NextResponse } from "next/server";
import { getDb } from "@/lib/db";

export async function GET() {
  const db = getDb();
  const salesmen = db
    .prepare("SELECT * FROM salesmen ORDER BY name")
    .all();
  return NextResponse.json(salesmen);
}

export async function POST(req: NextRequest) {
  const body = await req.json();
  const { name, phone, area, salary = 0, status = "active" } = body;

  if (!name) {
    return NextResponse.json({ error: "Name required" }, { status: 400 });
  }

  const db = getDb();
  const result = db
    .prepare(
      `INSERT INTO salesmen (name, phone, area, salary, status)
       VALUES (?, ?, ?, ?, ?)`
    )
    .run(name, phone || null, area || null, salary, status);

  const salesman = db.prepare("SELECT * FROM salesmen WHERE id = ?").get(result.lastInsertRowid);
  return NextResponse.json(salesman, { status: 201 });
}

export async function PUT(req: NextRequest) {
  const body = await req.json();
  const { id, name, phone, area, salary, status } = body;

  if (!id) {
    return NextResponse.json({ error: "ID required" }, { status: 400 });
  }

  const db = getDb();
  db.prepare(
    `UPDATE salesmen SET name=?, phone=?, area=?, salary=?, status=? WHERE id=?`
  ).run(name, phone || null, area || null, salary || 0, status || "active", id);

  const salesman = db.prepare("SELECT * FROM salesmen WHERE id = ?").get(id);
  return NextResponse.json(salesman);
}

export async function DELETE(req: NextRequest) {
  const { searchParams } = new URL(req.url);
  const id = searchParams.get("id");
  if (!id) {
    return NextResponse.json({ error: "ID required" }, { status: 400 });
  }

  const db = getDb();
  const hasSales = db.prepare("SELECT COUNT(*) as c FROM sales WHERE salesman_id = ?").get(id) as { c: number };
  if (hasSales.c > 0) {
    return NextResponse.json(
      { error: "Cannot delete. This salesman has sales records attached." },
      { status: 400 }
    );
  }
  db.prepare("DELETE FROM salesmen WHERE id = ?").run(id);
  return NextResponse.json({ ok: true });
}
