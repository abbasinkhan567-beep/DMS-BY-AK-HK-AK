import { NextRequest, NextResponse } from "next/server";
import {
  runGitHubSync,
  setDeviceName,
  setSyncToken,
  syncStatus,
} from "@/lib/sync";

export async function GET() {
  return NextResponse.json(syncStatus());
}

export async function POST(req: NextRequest) {
  const body = await req.json().catch(() => ({}));
  const action = body.action || "sync";

  if (action === "save") {
    if (typeof body.deviceName === "string") setDeviceName(body.deviceName);
    if (typeof body.token === "string") setSyncToken(body.token);
    return NextResponse.json({ ok: true, ...syncStatus() });
  }

  if (action === "sync" || action === "auto") {
    const status = syncStatus();
    if (action === "auto" && !status.hasRemote) {
      return NextResponse.json({
        ok: true,
        skipped: true,
        message: "GitHub not set yet",
        ...status,
      });
    }
    try {
      const result = runGitHubSync();
      return NextResponse.json({ ...result, ...syncStatus() });
    } catch (e) {
      return NextResponse.json(
        {
          ok: false,
          error: e instanceof Error ? e.message : String(e),
          ...syncStatus(),
        },
        { status: 500 }
      );
    }
  }

  return NextResponse.json({ error: "Unknown action" }, { status: 400 });
}
