import fs from "fs";
import path from "path";
import { dbPath, getDb, resetDbConnection } from "@/lib/db";

export const backupsDir = path.join(process.cwd(), "data", "backups");
export const docsBackupDir = path.join(
  process.env.USERPROFILE || process.env.HOME || process.cwd(),
  "Documents",
  "Pepsi-Distribution-Backups"
);

const DAY_ONE = "pepsi-day-one.db";
const MARKER = path.join(backupsDir, ".last-auto-backup");

export type BackupInfo = {
  name: string;
  size: number;
  createdAt: string;
  path: string;
  location: "app" | "documents";
  protected?: boolean;
};

function ensureDirs() {
  if (!fs.existsSync(backupsDir)) fs.mkdirSync(backupsDir, { recursive: true });
  try {
    if (!fs.existsSync(docsBackupDir)) fs.mkdirSync(docsBackupDir, { recursive: true });
  } catch {
    /* Documents folder may be unavailable */
  }
}

function stamp() {
  const d = new Date();
  const pad = (n: number) => String(n).padStart(2, "0");
  return `${d.getFullYear()}-${pad(d.getMonth() + 1)}-${pad(d.getDate())}_${pad(d.getHours())}${pad(d.getMinutes())}${pad(d.getSeconds())}`;
}

function copyDbFile(src: string, dest: string) {
  try {
    const db = getDb();
    db.pragma("wal_checkpoint(FULL)");
  } catch {
    /* ignore */
  }
  resetDbConnection();
  fs.copyFileSync(src, dest);
  getDb();
}

/** First-ever backup — never overwritten, never deleted. */
export function ensureDayOneBackup(): BackupInfo | null {
  ensureDirs();
  if (!fs.existsSync(dbPath)) return null;
  const appDayOne = path.join(backupsDir, DAY_ONE);
  if (fs.existsSync(appDayOne)) return null;

  getDb();
  copyDbFile(dbPath, appDayOne);
  try {
    fs.copyFileSync(appDayOne, path.join(docsBackupDir, DAY_ONE));
  } catch {
    /* ignore */
  }

  const st = fs.statSync(appDayOne);
  return {
    name: DAY_ONE,
    size: st.size,
    createdAt: st.mtime.toISOString(),
    path: appDayOne,
    location: "app",
    protected: true,
  };
}

export function listBackups(): BackupInfo[] {
  ensureDirs();
  const collect = (dir: string, location: "app" | "documents"): BackupInfo[] => {
    if (!fs.existsSync(dir)) return [];
    return fs
      .readdirSync(dir)
      .filter(
        (f) =>
          (f.startsWith("pepsi-backup-") || f === DAY_ONE) &&
          f.endsWith(".db") &&
          f !== "pepsi-latest.db"
      )
      .map((name) => {
        const full = path.join(dir, name);
        const st = fs.statSync(full);
        return {
          name,
          size: st.size,
          createdAt: st.mtime.toISOString(),
          path: full,
          location,
          protected: name === DAY_ONE,
        };
      });
  };

  return [...collect(backupsDir, "app"), ...collect(docsBackupDir, "documents")].sort((a, b) => {
    if (a.protected && !b.protected) return -1;
    if (!a.protected && b.protected) return 1;
    return +new Date(b.createdAt) - +new Date(a.createdAt);
  });
}

export function createBackup(reason: "manual" | "auto" = "manual"): BackupInfo {
  ensureDirs();
  getDb();
  ensureDayOneBackup();

  const name = `pepsi-backup-${stamp()}.db`;
  const appTarget = path.join(backupsDir, name);

  copyDbFile(dbPath, appTarget);
  fs.copyFileSync(appTarget, path.join(backupsDir, "pepsi-latest.db"));

  try {
    const docsTarget = path.join(docsBackupDir, name);
    fs.copyFileSync(appTarget, docsTarget);
    fs.copyFileSync(appTarget, path.join(docsBackupDir, "pepsi-latest.db"));
  } catch {
    /* Documents copy is best-effort */
  }

  // Never delete old backups — keep day one and full history forever

  if (reason === "auto") {
    fs.writeFileSync(MARKER, new Date().toISOString(), "utf8");
  }

  const st = fs.statSync(appTarget);
  return {
    name,
    size: st.size,
    createdAt: st.mtime.toISOString(),
    path: appTarget,
    location: "app",
  };
}

export function shouldAutoBackupToday(): boolean {
  ensureDirs();
  if (!fs.existsSync(dbPath)) return false;
  ensureDayOneBackup();
  if (!fs.existsSync(MARKER)) return true;
  try {
    const last = fs.readFileSync(MARKER, "utf8").trim();
    const day = last.slice(0, 10);
    const today = new Date().toISOString().slice(0, 10);
    return day !== today;
  } catch {
    return true;
  }
}

export function ensureDailyAutoBackup(): BackupInfo | null {
  ensureDayOneBackup();
  if (!shouldAutoBackupToday()) return null;
  return createBackup("auto");
}

export function restoreBackup(fileName: string): { ok: true; restored: string } {
  ensureDirs();
  const safe = path.basename(fileName);
  const allowed =
    safe === DAY_ONE || (safe.startsWith("pepsi-backup-") && safe.endsWith(".db"));
  if (!allowed) throw new Error("Invalid backup file name");

  const candidates = [path.join(backupsDir, safe), path.join(docsBackupDir, safe)];
  const source = candidates.find((p) => fs.existsSync(p));
  if (!source) throw new Error("Backup file not found");

  createBackup("manual");

  resetDbConnection();
  fs.copyFileSync(source, dbPath);
  for (const extra of [`${dbPath}-wal`, `${dbPath}-shm`]) {
    if (fs.existsSync(extra)) {
      try {
        fs.unlinkSync(extra);
      } catch {
        /* ignore */
      }
    }
  }
  getDb();

  return { ok: true, restored: safe };
}

export function readBackupFile(fileName?: string): { buffer: Buffer; fileName: string } {
  if (!fileName || fileName === "current") {
    getDb();
    try {
      getDb().pragma("wal_checkpoint(FULL)");
    } catch {
      /* ignore */
    }
    resetDbConnection();
    const buffer = fs.readFileSync(dbPath);
    getDb();
    return {
      buffer,
      fileName: `pepsi-backup-${new Date().toISOString().slice(0, 10)}.db`,
    };
  }

  const safe = path.basename(fileName);
  const candidates = [path.join(backupsDir, safe), path.join(docsBackupDir, safe)];
  const source = candidates.find((p) => fs.existsSync(p));
  if (!source) throw new Error("Backup not found");
  return { buffer: fs.readFileSync(source), fileName: safe };
}

export function backupStatus() {
  ensureDirs();
  ensureDayOneBackup();
  const list = listBackups();
  let lastAuto: string | null = null;
  if (fs.existsSync(MARKER)) {
    try {
      lastAuto = fs.readFileSync(MARKER, "utf8").trim();
    } catch {
      lastAuto = null;
    }
  }
  const dayOne = list.find((b) => b.protected);
  return {
    backupsDir,
    docsBackupDir,
    keepForever: true,
    dayOneBackup: dayOne?.name || (fs.existsSync(path.join(backupsDir, DAY_ONE)) ? DAY_ONE : null),
    lastAutoBackup: lastAuto,
    autoDueToday: shouldAutoBackupToday(),
    count: list.length,
    latest: list.find((b) => !b.protected) || null,
    liveDbExists: fs.existsSync(dbPath),
    liveDbSize: fs.existsSync(dbPath) ? fs.statSync(dbPath).size : 0,
  };
}
