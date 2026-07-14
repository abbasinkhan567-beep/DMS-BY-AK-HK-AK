import { NextRequest, NextResponse } from "next/server";
import { getDb, hashPassword } from "@/lib/db";
import { seedIfEmpty } from "@/lib/seed";

/** Verify Settings unlock password (not login password). */
export async function POST(req: NextRequest) {
  seedIfEmpty();
  const body = await req.json().catch(() => ({}));
  const password = String(body.password || "");

  const db = getDb();
  let row = db
    .prepare("SELECT value FROM app_settings WHERE key = 'settings_password_hash'")
    .get() as { value: string } | undefined;

  // Migrate older installs that only had login password
  if (!row) {
    db.prepare("INSERT INTO app_settings (key, value) VALUES ('settings_password_hash', ?)").run(
      hashPassword("settings123")
    );
    row = db
      .prepare("SELECT value FROM app_settings WHERE key = 'settings_password_hash'")
      .get() as { value: string };
  }

  if (!row || row.value !== hashPassword(password)) {
    return NextResponse.json({ error: "Incorrect settings password" }, { status: 401 });
  }

  return NextResponse.json({ ok: true });
}
