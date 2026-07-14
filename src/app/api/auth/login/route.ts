import { NextRequest, NextResponse } from "next/server";
import { getDb, hashPassword } from "@/lib/db";
import { createSessionTokenEdge, sessionCookieOptions, SESSION_COOKIE } from "@/lib/auth-edge";
import { seedIfEmpty } from "@/lib/seed";

function isHttps(req: NextRequest) {
  const xf = req.headers.get("x-forwarded-proto");
  if (xf) return xf.split(",")[0]?.trim() === "https";
  return req.nextUrl.protocol === "https:";
}

export async function POST(req: NextRequest) {
  try {
    seedIfEmpty();
    const body = await req.json().catch(() => ({}));
    const password = String(body.password || "");

    const db = getDb();
    const row = db.prepare("SELECT value FROM app_settings WHERE key = 'password_hash'").get() as
      | { value: string }
      | undefined;

    if (!row || row.value !== hashPassword(password)) {
      return NextResponse.json({ error: "Incorrect password" }, { status: 401 });
    }

    const token = await createSessionTokenEdge();
    const res = NextResponse.json({ ok: true, message: "Logged in" });
    res.cookies.set(SESSION_COOKIE, token, sessionCookieOptions(undefined, { secure: isHttps(req) }));
    return res;
  } catch (e) {
    console.error("login error", e);
    return NextResponse.json(
      { error: e instanceof Error ? e.message : "Login failed" },
      { status: 500 }
    );
  }
}
