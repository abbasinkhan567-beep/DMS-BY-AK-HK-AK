import fs from "fs";
import path from "path";
import crypto from "crypto";
import { execSync } from "child_process";
import { dbPath, getDb, resetDbConnection } from "@/lib/db";
import { createBackup } from "@/lib/backup";
import { mergeRemoteIntoLocal } from "@/lib/merge-db";
import { ensureSyncSchema } from "@/lib/sync-ids";
import { DEFAULT_GITHUB_REPO } from "@/lib/repo";

const SYNC_BRANCH = "data-sync";
const SYNC_LOCK = path.join(process.cwd(), "data", ".sync.lock");

export type SyncMeta = {
  updatedAt: string;
  deviceId: string;
  deviceName: string;
  size: number;
  checksum?: string;
};

export type SyncResult = {
  ok: boolean;
  action: "none" | "uploaded" | "downloaded" | "merged" | "initialized";
  message: string;
  meta?: SyncMeta | null;
  lastSyncAt?: string;
  added?: number;
  updated?: number;
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

function ensureGitRepo() {
  if (!fs.existsSync(path.join(process.cwd(), ".git"))) {
    run("git init -b main");
    run('git config user.email "pepsi@local"');
    run('git config user.name "Pepsi Distribution"');
  }
}

function getOriginUrl(): string | null {
  ensureGitRepo();
  try {
    return run("git remote get-url origin").trim() || null;
  } catch {
    try {
      run(`git remote add origin ${DEFAULT_GITHUB_REPO}`);
      return DEFAULT_GITHUB_REPO;
    } catch {
      return null;
    }
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

function withSyncLock<T>(fn: () => T): T {
  if (fs.existsSync(SYNC_LOCK)) {
    const age = Date.now() - fs.statSync(SYNC_LOCK).mtimeMs;
    if (age < 3 * 60 * 1000) {
      throw new Error("Sync already running on this PC — try again in a minute.");
    }
  }
  fs.writeFileSync(SYNC_LOCK, String(Date.now()), "utf8");
  try {
    return fn();
  } finally {
    try {
      fs.unlinkSync(SYNC_LOCK);
    } catch {
      /* ignore */
    }
  }
}

export function runGitHubSync(): SyncResult {
  return withSyncLock(() => runGitHubSyncInner());
}

function runGitHubSyncInner(): SyncResult {
  if (!hasGit()) {
    return { ok: false, action: "none", message: "Git is not installed. Install from git-scm.com" };
  }

  ensureSyncSchema(getDb());

  const rawOrigin = getOriginUrl();
  if (!rawOrigin) {
    return {
      ok: false,
      action: "none",
      message: "Set GitHub URL first in Settings → Updates, then Sync.",
    };
  }

  const origin = authedRemoteUrl(rawOrigin);

  try {
    createBackup("manual");
  } catch {
    /* still continue sync */
  }

  const exists = remoteBranchExists(origin);
  if (!exists) {
    try {
      const local = localMeta();
      pushLocalDb(origin, local);
      const now = new Date().toISOString();
      settingSet("last_sync_at", now);
      settingSet("last_push_at", local.updatedAt);
      settingSet("last_pull_at", local.updatedAt);
      return {
        ok: true,
        action: "initialized",
        message: "First sync uploaded. Other PC Sync Now pe merge ho jayega.",
        meta: local,
        lastSyncAt: now,
      };
    } catch (e) {
      return {
        ok: false,
        action: "none",
        message:
          "Upload failed. Add a GitHub token in Sync settings. " +
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

  const localBefore = localMeta();
  if (remoteMeta.checksum && localBefore.checksum && remoteMeta.checksum === localBefore.checksum) {
    const now = new Date().toISOString();
    settingSet("last_sync_at", now);
    return {
      ok: true,
      action: "none",
      message: "Already up to date — dono taraf same data.",
      meta: localBefore,
      lastSyncAt: now,
    };
  }

  // Merge remote rows into local (no overwrite of whole DB)
  let merge;
  try {
    merge = mergeRemoteIntoLocal(remoteDb);
  } catch (e) {
    reopenDb();
    return {
      ok: false,
      action: "none",
      message: "Merge failed: " + String(e instanceof Error ? e.message : e).slice(0, 180),
    };
  }

  // Always publish merged database so other PC gets everything
  try {
    const local = localMeta();
    pushLocalDb(origin, local);
    const now = new Date().toISOString();
    settingSet("last_sync_at", now);
    settingSet("last_push_at", local.updatedAt);
    settingSet("last_pull_at", remoteMeta.updatedAt);
    return {
      ok: true,
      action: "merged",
      message: merge.message,
      meta: local,
      lastSyncAt: now,
      added: merge.added,
      updated: merge.updated,
    };
  } catch (e) {
    reopenDb();
    return {
      ok: false,
      action: "none",
      message:
        "Merged locally but upload failed (token?). " +
        String(e instanceof Error ? e.message : e).slice(0, 160),
    };
  }
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
    mode: "merge",
  };
}
