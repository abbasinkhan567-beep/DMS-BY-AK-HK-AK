import { NextRequest, NextResponse } from "next/server";
import { getDb, hashPassword } from "@/lib/db";
import { seedIfEmpty } from "@/lib/seed";

function updatePassword(
  db: ReturnType<typeof getDb>,
  key: "password_hash" | "settings_password_hash",
  current_password: string,
  new_password: string
) {
  if (!new_password || String(new_password).length < 4) {
    return { error: "New password must be at least 4 characters", status: 400 as const };
  }
  const row = db.prepare("SELECT value FROM app_settings WHERE key = ?").get(key) as
    | { value: string }
    | undefined;
  if (!row || row.value !== hashPassword(current_password || "")) {
    return { error: "Current password is incorrect", status: 400 as const };
  }
  db.prepare(
    `INSERT INTO app_settings (key, value) VALUES (?, ?)
     ON CONFLICT(key) DO UPDATE SET value = excluded.value`
  ).run(key, hashPassword(new_password));
  return { ok: true as const };
}

export async function GET() {
  seedIfEmpty();
  const db = getDb();
  const company = db.prepare("SELECT * FROM company_info WHERE id = 1").get();
  return NextResponse.json({ company });
}

export async function PUT(req: NextRequest) {
  const body = await req.json();
  const { section } = body;
  const db = getDb();

  if (section === "company") {
    const { name, phone, email, address, city, ntn, owner_name } = body;
    db.prepare(
      `UPDATE company_info SET name=?, phone=?, email=?, address=?, city=?, ntn=?, owner_name=?,
       updated_at=datetime('now','localtime') WHERE id=1`
    ).run(name || "", phone || "", email || "", address || "", city || "", ntn || "", owner_name || "");
    const company = db.prepare("SELECT * FROM company_info WHERE id = 1").get();
    return NextResponse.json({ company });
  }

  // Login password (app login screen)
  if (section === "password" || section === "login_password") {
    const result = updatePassword(
      db,
      "password_hash",
      body.current_password,
      body.new_password
    );
    if ("error" in result) {
      return NextResponse.json({ error: result.error }, { status: result.status });
    }
    return NextResponse.json({ ok: true, message: "Login password updated" });
  }

  // Settings unlock password
  if (section === "settings_password") {
    // Ensure key exists for older DBs
    const existing = db
      .prepare("SELECT value FROM app_settings WHERE key = 'settings_password_hash'")
      .get();
    if (!existing) {
      db.prepare("INSERT INTO app_settings (key, value) VALUES ('settings_password_hash', ?)").run(
        hashPassword("settings123")
      );
    }
    const result = updatePassword(
      db,
      "settings_password_hash",
      body.current_password,
      body.new_password
    );
    if ("error" in result) {
      return NextResponse.json({ error: result.error }, { status: result.status });
    }
    return NextResponse.json({ ok: true, message: "Settings password updated" });
  }

  return NextResponse.json({ error: "Unknown section" }, { status: 400 });
}
