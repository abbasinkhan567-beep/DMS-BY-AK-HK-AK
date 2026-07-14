import fs from "fs";
import path from "path";
import crypto from "crypto";
import { execSync } from "child_process";
import { dbPath, getDb, resetDbConnection } from "@/lib/db";
import { createBackup } from "@/lib/backup";

const SYNC_BRANCH = "data-sync";

export type SyncMeta = {
  updatedAt: string;
  deviceId: string;
  deviceName: string;
  size: number;
  checksum?: string;
};

export type SyncResult = {
  ok: boolean;
  action: "none" | "uploaded" | "downloaded" | "conflict_kept_newer" | "initialized";
  message: string;
  meta?: SyncMeta | null;
  lastSyncAt?: string;
};

function settingGet(key: string): string | null {
  const row = getDb()
    .prepare("SELECT value FROM app_settings WHERE key = ?")
    .get(key) as { value: string } | undefined;
  return row?.value ?? null;
}

function settingSet(key: string, value: string) {
  getDb()
    .prepare(
      `INSERT INTO app_settings (key, value) VALUES (?, ?)
       ON CONFLICT(key) DO UPDATE SET value = excluded.value`
    )
    .run(key, value);
}

export function getOrCreateDeviceId() {
  let id = settingGet("device_id");
  if (!id) {
    id = crypto.randomBytes(8).toString("hex");
    settingSet("device_id", id);
  }
  return id;
}

export function getDeviceName() {
  return settingGet("device_name") || process.env.COMPUTERNAME || "PC";
}

export function setDeviceName(name: string) {
  settingSet("device_name", name.trim() || "PC");
}

export function setSyncToken(token: string) {
  settingSet("github_sync_token", token.trim());
}

export function getSyncToken() {
  return settingGet("github_sync_token") || "";
}

function run(cmd: string, cwd = process.cwd()) {
  return execSync(cmd, {
    cwd,
    encoding: "utf8",
    windowsHide: true,
    stdio: ["pipe", "pipe", "pipe"],
    env: { ...process.env, GIT_TERMINAL_PROMPT: "0" },
  });
}

function hasGit() {
  try {
    run("git --version");
    return true;
  } catch {
    return false;
  }
}

function getOriginUrl(): string | null {
  try {
    return run("git remote get-url origin").trim() || null;
  } catch {
    return null;
  }
}

/** Inject token into https GitHub URL for push/pull without interactive login. */
function authedRemoteUrl(url: string): string {
  const token = getSyncToken();
  if (!token) return url;
  if (url.startsWith("https://") && url.includes("github.com")) {
    return url.replace("https://", `https://${token}@`);
  }
  return url;
}

function flushDb() {
  try {
    getDb().pragma("wal_checkpoint(FULL)");
  } catch {
    /* ignore */
  }
  resetDbConnection();
}

function reopenDb() {
  getDb();
}

function checksum(file: string) {
  return crypto.createHash("sha256").update(fs.readFileSync(file)).digest("hex").slice(0, 16);
}

function localMeta(): SyncMeta {
  flushDb();
  const st = fs.statSync(dbPath);
  const meta: SyncMeta = {
    updatedAt: st.mtime.toISOString(),
    deviceId: getOrCreateDeviceId(),
    deviceName: getDeviceName(),
    size: st.size,
    checksum: checksum(dbPath),
  };
  reopenDb();
  return meta;
}

function tmpDir() {
  const dir = path.join(process.cwd(), ".pepsi-cloud-sync");
  if (fs.existsSync(dir)) fs.rmSync(dir, { recursive: true, force: true });
  fs.mkdirSync(dir, { recursive: true });
  return dir;
}

function remoteBranchExists(origin: string): boolean {
  try {
    const out = run(`git ls-remote --heads "${origin}" ${SYNC_BRANCH}`).trim();
    return out.length > 0;
  } catch {
    return false;
  }
}

function fetchRemoteMeta(origin: string): { meta: SyncMeta | null; dbFile: string | null } {
  const dir = tmpDir();
  try {
    run(
      `git clone --branch ${SYNC_BRANCH} --single-branch --depth 1 "${origin}" "${dir}"`
    );
  } catch {
    return { meta: null, dbFile: null };
  }
  const dbFile = path.join(dir, "pepsi.db");
  const metaFile = path.join(dir, "meta.json");
  if (!fs.existsSync(dbFile)) return { meta: null, dbFile: null };
  let meta: SyncMeta | null = null;
  if (fs.existsSync(metaFile)) {
    try {
      meta = JSON.parse(fs.readFileSync(metaFile, "utf8")) as SyncMeta;
    } catch {
      meta = null;
    }
  }
  if (!meta) {
    const st = fs.statSync(dbFile);
    meta = {
      updatedAt: st.mtime.toISOString(),
      deviceId: "remote",
      deviceName: "remote",
      size: st.size,
      checksum: checksum(dbFile),
    };
  }
  return { meta, dbFile };
}

function pushLocalDb(origin: string, meta: SyncMeta): void {
  flushDb();
  const dir = tmpDir();
  fs.copyFileSync(dbPath, path.join(dir, "pepsi.db"));
  fs.writeFileSync(path.join(dir, "meta.json"), JSON.stringify(meta, null, 2), "utf8");
  run("git init -b " + SYNC_BRANCH, dir);
  run(`git remote add origin "${origin}"`, dir);
  run('git config user.email "pepsi-sync@local"', dir);
  run('git config user.name "Pepsi Sync"', dir);
  run("git add pepsi.db meta.json", dir);
  run('git commit -m "data sync"', dir);
  run(`git push -f origin ${SYNC_BRANCH}`, dir);
  reopenDb();
}

export function runGitHubSync(): SyncResult {
  if (!hasGit()) {
    return { ok: false, action: "none", message: "Git is not installed. Install from git-scm.com" };
  }

  const rawOrigin = getOriginUrl();
  if (!rawOrigin) {
    return {
      ok: false,
      action: "none",
      message: "Set GitHub URL first in Settings → Updates, then Sync.",
    };
  }

  const origin = authedRemoteUrl(rawOrigin);
  const local = localMeta();
  const lastPushAt = settingGet("last_push_at");
  const lastSyncAt = settingGet("last_sync_at");

  const exists = remoteBranchExists(origin);
  if (!exists) {
    try {
      createBackup("manual");
      pushLocalDb(origin, local);
      const now = new Date().toISOString();
      settingSet("last_sync_at", now);
      settingSet("last_push_at", local.updatedAt);
      settingSet("last_pull_at", local.updatedAt);
      return {
        ok: true,
        action: "initialized",
        message: "First sync uploaded to GitHub. Office can Sync Now to receive it.",
        meta: local,
        lastSyncAt: now,
      };
    } catch (e) {
      return {
        ok: false,
        action: "none",
        message:
          "Upload failed. Add a GitHub token in Sync settings (or login git once). " +
          String(e instanceof Error ? e.message : e).slice(0, 180),
      };
    }
  }

  let remoteMeta: SyncMeta | null = null;
  let remoteDb: string | null = null;
  try {
    const fetched = fetchRemoteMeta(origin);
    remoteMeta = fetched.meta;
    remoteDb = fetched.dbFile;
  } catch (e) {
    return {
      ok: false,
      action: "none",
      message: "Could not read cloud data: " + String(e instanceof Error ? e.message : e).slice(0, 160),
    };
  }

  if (!remoteMeta || !remoteDb) {
    return { ok: false, action: "none", message: "Cloud sync data missing." };
  }

  if (remoteMeta.checksum && local.checksum && remoteMeta.checksum === local.checksum) {
    const now = new Date().toISOString();
    settingSet("last_sync_at", now);
    return {
      ok: true,
      action: "none",
      message: "Already up to date.",
      meta: local,
      lastSyncAt: now,
    };
  }

  const remoteUpdated = remoteMeta.updatedAt;
  const localUpdated = local.updatedAt;
  const localChangedSincePush = !lastPushAt || localUpdated > lastPushAt;

  // Local newer → upload
  if (localUpdated > remoteUpdated) {
    try {
      createBackup("manual");
      pushLocalDb(origin, local);
      const now = new Date().toISOString();
      settingSet("last_sync_at", now);
      settingSet("last_push_at", localUpdated);
      return {
        ok: true,
        action: "uploaded",
        message: "Your data was uploaded. Other PC will get it on Sync / when online.",
        meta: local,
        lastSyncAt: now,
      };
    } catch (e) {
      reopenDb();
      return {
        ok: false,
        action: "none",
        message:
          "Upload failed (need GitHub login/token). " +
          String(e instanceof Error ? e.message : e).slice(0, 160),
      };
    }
  }

  // Remote newer → download
  if (remoteUpdated > localUpdated) {
    try {
      createBackup("manual");
      flushDb();
      fs.copyFileSync(remoteDb, dbPath);
      for (const extra of [`${dbPath}-wal`, `${dbPath}-shm`]) {
        if (fs.existsSync(extra)) {
          try {
            fs.unlinkSync(extra);
          } catch {
            /* ignore */
          }
        }
      }
      reopenDb();
      const now = new Date().toISOString();
      settingSet("last_sync_at", now);
      settingSet("last_pull_at", remoteUpdated);
      settingSet("last_push_at", remoteUpdated);
      const conflict = localChangedSincePush && Boolean(lastSyncAt);
      return {
        ok: true,
        action: conflict ? "conflict_kept_newer" : "downloaded",
        message: conflict
          ? "Both PCs changed — kept newer cloud copy. Previous local data is in Backups."
          : "Downloaded latest data from GitHub.",
        meta: remoteMeta,
        lastSyncAt: now,
      };
    } catch (e) {
      reopenDb();
      return {
        ok: false,
        action: "none",
        message: "Download failed: " + String(e instanceof Error ? e.message : e).slice(0, 160),
      };
    }
  }

  const now = new Date().toISOString();
  settingSet("last_sync_at", now);
  return { ok: true, action: "none", message: "Nothing to sync.", lastSyncAt: now };
}

export function syncStatus() {
  let remoteUrl = "";
  try {
    remoteUrl = getOriginUrl() || "";
  } catch {
    remoteUrl = "";
  }
  return {
    deviceId: getOrCreateDeviceId(),
    deviceName: getDeviceName(),
    lastSyncAt: settingGet("last_sync_at"),
    hasGit: hasGit(),
    hasRemote: Boolean(remoteUrl),
    remoteUrl,
    hasToken: Boolean(getSyncToken()),
    syncBranch: SYNC_BRANCH,
  };
}
