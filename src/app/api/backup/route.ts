import { NextRequest, NextResponse } from "next/server";
import {
  backupStatus,
  createBackup,
  ensureDailyAutoBackup,
  listBackups,
  readBackupFile,
  restoreBackup,
} from "@/lib/backup";

export async function GET(req: NextRequest) {
  const download = req.nextUrl.searchParams.get("download");
  const file = req.nextUrl.searchParams.get("file") || undefined;

  if (download === "1" || download === "true") {
    try {
      const { buffer, fileName } = readBackupFile(file || "current");
      return new NextResponse(new Uint8Array(buffer), {
        headers: {
          "Content-Type": "application/octet-stream",
          "Content-Disposition": `attachment; filename="${fileName}"`,
        },
      });
    } catch (e) {
      return NextResponse.json(
        { error: e instanceof Error ? e.message : "Download failed" },
        { status: 404 }
      );
    }
  }

  // Trigger daily auto-backup when Settings/backup status is checked
  try {
    ensureDailyAutoBackup();
  } catch {
    /* don't fail status for auto issues */
  }

  return NextResponse.json({
    ...backupStatus(),
    backups: listBackups().slice(0, 40),
  });
}

export async function POST(req: NextRequest) {
  const body = await req.json().catch(() => ({}));
  const action = body.action || "create";

  try {
    if (action === "create" || action === "manual") {
      const info = createBackup("manual");
      return NextResponse.json({
        ok: true,
        message: "Local backup saved in app folder and Documents.",
        backup: info,
        status: backupStatus(),
        backups: listBackups().slice(0, 40),
      });
    }

    if (action === "auto") {
      const info = ensureDailyAutoBackup();
      return NextResponse.json({
        ok: true,
        created: Boolean(info),
        message: info
          ? "Daily auto backup created."
          : "Auto backup already done for today.",
        backup: info,
        status: backupStatus(),
        backups: listBackups().slice(0, 40),
      });
    }

    if (action === "restore") {
      const fileName = String(body.fileName || "").trim();
      if (!fileName) {
        return NextResponse.json({ error: "Backup file name required" }, { status: 400 });
      }
      const result = restoreBackup(fileName);
      return NextResponse.json({
        ...result,
        message: `Restored from ${result.restored}. Refresh the page.`,
        status: backupStatus(),
        backups: listBackups().slice(0, 40),
      });
    }

    return NextResponse.json({ error: "Unknown action" }, { status: 400 });
  } catch (e) {
    return NextResponse.json(
      { error: e instanceof Error ? e.message : String(e) },
      { status: 500 }
    );
  }
}
