import { NextRequest, NextResponse } from "next/server";
import {
  runGitHubSync,
  setDeviceName,
  setSyncToken,
  syncStatus,
} from "@/lib/sync";

export async function GET() {
  try {
    return NextResponse.json(syncStatus());
  } catch (e) {
    console.error("sync GET error", e);
    return NextResponse.json(
      { error: e instanceof Error ? e.message : "Sync status failed" },
      { status: 500 }
    );
  }
}

export async function POST(req: NextRequest) {
  try {
    const body = await req.json().catch(() => ({}));
    const action = body.action || "sync";

    if (action === "save") {
      if (typeof body.deviceName === "string") setDeviceName(body.deviceName);
      if (typeof body.token === "string" && body.token.trim().length > 0) setSyncToken(body.token);
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
  } catch (e) {
    console.error("sync POST error", e);
    return NextResponse.json(
      { error: e instanceof Error ? e.message : "Sync failed" },
      { status: 500 }
    );
  }
}