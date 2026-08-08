import fs from "fs";
import path from "path";
import { execSync } from "child_process";
import { dbPath, getDb, resetDbConnection } from "@/lib/db";
import { todayLocal } from "@/lib/utils";
import { injectGitHubToken, normalizeGitHubRepoUrl } from "@/lib/github-url";
import { DEFAULT_GITHUB_REPO } from "@/lib/repo";

export const backupsDir = path.join(process.cwd(), "data", "backups");
export const docsBackupDir = path.join(
  process.env.USERPROFILE || process.env.HOME || process.cwd(),
  "Documents",
  "Pepsi-Distribution-Backups"
);

const DAY_ONE = "pepsi-day-one.db";
const MARKER = path.join(backupsDir, ".last-auto-backup");
const GITHUB_BACKUP_BRANCH = "data-backups";
const GITHUB_ROOT = path.join(process.cwd(), "data", "backup-repo");
const GITHUB_MARKER = path.join(process.cwd(), "data", ".github-last-backup");
const GITHUB_KEEP = 12;

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
    const today = todayLocal();
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

export function deleteBackup(fileName: string): { ok: true; deleted: string } {
  ensureDirs();
  const safe = path.basename(fileName);
  if (safe === DAY_ONE) throw new Error("Cannot delete Day One backup");
  const allowed = safe.startsWith("pepsi-backup-") && safe.endsWith(".db");
  if (!allowed) throw new Error("Invalid backup file name");

  const appPath = path.join(backupsDir, safe);
  const docsPath = path.join(docsBackupDir, safe);

  let deleted = false;
  if (fs.existsSync(appPath)) {
    fs.unlinkSync(appPath);
    deleted = true;
  }
  try {
    if (fs.existsSync(docsPath)) {
      fs.unlinkSync(docsPath);
    }
  } catch {
    /* best-effort */
  }

  if (!deleted) throw new Error("Backup file not found");

  return { ok: true, deleted: safe };
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
      fileName: `pepsi-backup-${todayLocal()}.db`,
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
    github: getGithubBackupStatus(),
  };
}

function ghRun(cmd: string, cwd: string = GITHUB_ROOT) {
  return execSync(cmd, {
    cwd,
    encoding: "utf8",
    windowsHide: true,
    stdio: ["pipe", "pipe", "pipe"],
    env: { ...process.env, GIT_TERMINAL_PROMPT: "0" },
  });
}

function getGithubToken() {
  try {
    const row = getDb()
      .prepare("SELECT value FROM app_settings WHERE key = 'github_sync_token'")
      .get() as { value?: string } | undefined;
    return row?.value || "";
  } catch {
    return "";
  }
}

function getOriginUrl(): string {
  try {
    return ghRun("git remote get-url origin", process.cwd()).trim();
  } catch {
    return DEFAULT_GITHUB_REPO;
  }
}

export function getGithubBackupStatus(): {
  enabled: boolean;
  lastPush: string | null;
  file: string | null;
} {
  if (!fs.existsSync(GITHUB_MARKER)) {
    return { enabled: false, lastPush: null, file: null };
  }
  try {
    const j = JSON.parse(fs.readFileSync(GITHUB_MARKER, "utf8")) as {
      at?: string;
      file?: string;
    };
    return { enabled: true, lastPush: j.at || null, file: j.file || null };
  } catch {
    return { enabled: false, lastPush: null, file: null };
  }
}

/**
 * Push a dated backup copy to GitHub (branch `data-backups`) so backups
 * exist both locally (date-stamped folders) and in the cloud. Keeps only
 * the newest GITHUB_KEEP files on the remote branch.
 */
export function pushBackupToGitHub(fileName?: string): { ok: boolean; message: string } {
  try {
    const token = getGithubToken();
    if (!token) {
      return { ok: false, message: "No GitHub token set. Add it in Settings > Sync." };
    }

    let url = normalizeGitHubRepoUrl(getOriginUrl());
    url = injectGitHubToken(url, token);

    if (!fileName) {
      const latest = listBackups().find((b) => !b.protected);
      if (latest) fileName = latest.name;
    }
    const safe = fileName ? path.basename(fileName) : "";
    if (!safe || (!safe.startsWith("pepsi-backup-") && safe !== DAY_ONE) || !safe.endsWith(".db")) {
      return { ok: false, message: "No backup file available to push" };
    }
    const src = path.join(backupsDir, safe);
    if (!fs.existsSync(src)) {
      return { ok: false, message: "Backup file not found" };
    }

    fs.mkdirSync(GITHUB_ROOT, { recursive: true });
    if (!fs.existsSync(path.join(GITHUB_ROOT, ".git"))) {
      ghRun(`git init -b ${GITHUB_BACKUP_BRANCH}`);
      ghRun('git config user.name "Pepsi Distribution Backup"');
      ghRun('git config user.email "pepsi@local"');
      ghRun(`git remote add origin ${url}`);
    } else {
      try {
        ghRun(`git remote set-url origin ${url}`);
      } catch {
        /* ignore */
      }
    }

    try {
      ghRun(`git fetch origin ${GITHUB_BACKUP_BRANCH} --depth 1`);
    } catch {
      /* branch may not exist yet */
    }
    const localBranches = ghRun("git branch --list").trim();
    if (localBranches.split("\n").some((b) => b.trim() === GITHUB_BACKUP_BRANCH)) {
      ghRun(`git checkout ${GITHUB_BACKUP_BRANCH}`);
    } else {
      try {
        ghRun(`git checkout -b ${GITHUB_BACKUP_BRANCH} origin/${GITHUB_BACKUP_BRANCH}`);
      } catch {
        ghRun(`git checkout -b ${GITHUB_BACKUP_BRANCH}`);
      }
    }

    const destDir = path.join(GITHUB_ROOT, "backups");
    fs.mkdirSync(destDir, { recursive: true });
    fs.copyFileSync(src, path.join(destDir, safe));

    const kept = fs
      .readdirSync(destDir)
      .filter((f) => f.startsWith("pepsi-backup-") && f.endsWith(".db"))
      .map((f) => {
        const p = path.join(destDir, f);
        return { f, m: fs.statSync(p).mtimeMs };
      })
      .sort((a, b) => b.m - a.m);
    for (const old of kept.slice(GITHUB_KEEP)) {
      try {
        fs.unlinkSync(path.join(destDir, old.f));
      } catch {
        /* ignore */
      }
    }

    ghRun("git add -A backups");
    const changed = ghRun("git status --porcelain").trim();
    if (changed) {
      ghRun(`git commit -m "backup ${safe}"`);
      ghRun(`git push origin ${GITHUB_BACKUP_BRANCH}`);
    }

    fs.writeFileSync(
      GITHUB_MARKER,
      JSON.stringify({ at: new Date().toISOString(), file: safe }),
      "utf8"
    );
    return { ok: true, message: `Pushed ${safe} to GitHub (${GITHUB_BACKUP_BRANCH} branch)` };
  } catch (e) {
    return { ok: false, message: e instanceof Error ? e.message : String(e) };
  }
}
