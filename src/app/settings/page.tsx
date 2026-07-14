"use client";

import { FormEvent, useEffect, useState } from "react";
import {
  Download,
  KeyRound,
  Building2,
  RefreshCw,
  CloudDownload,
  Palette,
  HardDrive,
  RotateCcw,
  Save,
  RefreshCcw,
} from "lucide-react";
import { Button, Card, Input, PageHeader, TextArea } from "@/components/ui";
import { ThemeSwitcher } from "@/components/ThemeSwitcher";
import { formatDate } from "@/lib/utils";

type Company = {
  name: string;
  phone: string;
  email: string;
  address: string;
  city: string;
  ntn: string;
  owner_name: string;
};

type UpdateInfo = {
  localVersion?: string;
  status?: string;
  message?: string;
  upToDate?: boolean;
  hasRemote?: boolean;
  remoteUrl?: string;
  gitInstalled?: boolean;
};

type BackupRow = {
  name: string;
  size: number;
  createdAt: string;
  location: "app" | "documents";
};

type BackupStatus = {
  backupsDir?: string;
  docsBackupDir?: string;
  maxKeep?: number;
  lastAutoBackup?: string | null;
  autoDueToday?: boolean;
  count?: number;
  liveDbSize?: number;
  backups?: BackupRow[];
};

type SyncStatus = {
  deviceName?: string;
  lastSyncAt?: string | null;
  hasGit?: boolean;
  hasRemote?: boolean;
  remoteUrl?: string;
  hasToken?: boolean;
  message?: string;
  action?: string;
  ok?: boolean;
  error?: string;
};

export default function SettingsPage() {
  const [unlocked, setUnlocked] = useState(false);
  const [gatePassword, setGatePassword] = useState("");
  const [gateError, setGateError] = useState("");
  const [gateLoading, setGateLoading] = useState(false);
  const [tab, setTab] = useState<
    "appearance" | "company" | "password" | "backup" | "sync" | "updates"
  >("sync");
  const [company, setCompany] = useState<Company>({
    name: "",
    phone: "",
    email: "",
    address: "",
    city: "",
    ntn: "",
    owner_name: "",
  });
  const [pwd, setPwd] = useState({ current_password: "", new_password: "", confirm: "" });
  const [settingsPwd, setSettingsPwd] = useState({
    current_password: "",
    new_password: "",
    confirm: "",
  });
  const [msg, setMsg] = useState("");
  const [err, setErr] = useState("");
  const [saving, setSaving] = useState(false);
  const [savingSettingsPwd, setSavingSettingsPwd] = useState(false);
  const [updateInfo, setUpdateInfo] = useState<UpdateInfo | null>(null);
  const [checking, setChecking] = useState(false);
  const [applying, setApplying] = useState(false);
  const [remoteUrl, setRemoteUrl] = useState("");
  const [backupInfo, setBackupInfo] = useState<BackupStatus | null>(null);
  const [backupBusy, setBackupBusy] = useState(false);
  const [syncInfo, setSyncInfo] = useState<SyncStatus | null>(null);
  const [deviceName, setDeviceNameInput] = useState("");
  const [syncToken, setSyncTokenInput] = useState("");
  const [syncBusy, setSyncBusy] = useState(false);

  async function unlockSettings(e: FormEvent) {
    e.preventDefault();
    setGateLoading(true);
    setGateError("");
    try {
      const res = await fetch("/api/auth/verify-password", {
        method: "POST",
        headers: { "Content-Type": "application/json" },
        body: JSON.stringify({ password: gatePassword }),
      });
      const data = await res.json();
      if (!res.ok) throw new Error(data.error || "Incorrect password");
      setUnlocked(true);
      setGatePassword("");
    } catch (err) {
      setGateError(err instanceof Error ? err.message : "Incorrect password");
    } finally {
      setGateLoading(false);
    }
  }

  useEffect(() => {
    if (!unlocked) return;
    fetch("/api/settings")
      .then((r) => r.json())
      .then((d) => {
        if (d.company) {
          setCompany({
            name: d.company.name || "",
            phone: d.company.phone || "",
            email: d.company.email || "",
            address: d.company.address || "",
            city: d.company.city || "",
            ntn: d.company.ntn || "",
            owner_name: d.company.owner_name || "",
          });
        }
      });
  }, [unlocked]);

  useEffect(() => {
    if (!unlocked) return;
    if (tab === "updates") {
      checkUpdates(false);
    }
    if (tab === "backup") {
      loadBackups();
    }
    if (tab === "sync") {
      loadSync();
    }
    // eslint-disable-next-line react-hooks/exhaustive-deps
  }, [tab, unlocked]);

  async function loadSync() {
    try {
      const res = await fetch("/api/sync");
      const data = await res.json();
      setSyncInfo(data);
      setDeviceNameInput(data.deviceName || "");
    } catch (e) {
      setErr(e instanceof Error ? e.message : "Could not load sync");
    }
  }

  async function saveSyncSettings() {
    setSyncBusy(true);
    setErr("");
    setMsg("");
    try {
      const res = await fetch("/api/sync", {
        method: "POST",
        headers: { "Content-Type": "application/json" },
        body: JSON.stringify({
          action: "save",
          deviceName,
          token: syncToken,
        }),
      });
      const data = await res.json();
      if (!res.ok) throw new Error(data.error || "Save failed");
      setSyncInfo(data);
      setSyncTokenInput("");
      setMsg("Sync settings saved");
    } catch (e) {
      setErr(e instanceof Error ? e.message : "Save failed");
    } finally {
      setSyncBusy(false);
    }
  }

  async function runSyncNow() {
    setSyncBusy(true);
    setErr("");
    setMsg("");
    try {
      await fetch("/api/sync", {
        method: "POST",
        headers: { "Content-Type": "application/json" },
        body: JSON.stringify({
          action: "save",
          deviceName,
          ...(syncToken ? { token: syncToken } : {}),
        }),
      });
      const res = await fetch("/api/sync", {
        method: "POST",
        headers: { "Content-Type": "application/json" },
        body: JSON.stringify({ action: "sync" }),
      });
      const data = await res.json();
      if (!res.ok || data.ok === false) throw new Error(data.error || data.message || "Sync failed");
      setSyncInfo(data);
      setMsg(data.message || "Synced");
      if (data.action === "downloaded" || data.action === "conflict_kept_newer") {
        setTimeout(() => window.location.reload(), 1000);
      }
    } catch (e) {
      setErr(e instanceof Error ? e.message : "Sync failed");
    } finally {
      setSyncBusy(false);
    }
  }

  async function loadBackups() {
    try {
      const res = await fetch("/api/backup");
      const data = await res.json();
      setBackupInfo(data);
    } catch (e) {
      setErr(e instanceof Error ? e.message : "Could not load backups");
    }
  }

  async function createLocalBackup() {
    setBackupBusy(true);
    setErr("");
    setMsg("");
    try {
      const res = await fetch("/api/backup", {
        method: "POST",
        headers: { "Content-Type": "application/json" },
        body: JSON.stringify({ action: "create" }),
      });
      const data = await res.json();
      if (!res.ok) throw new Error(data.error || "Backup failed");
      setMsg(data.message || "Backup saved");
      setBackupInfo({ ...data.status, backups: data.backups });
    } catch (e) {
      setErr(e instanceof Error ? e.message : "Backup failed");
    } finally {
      setBackupBusy(false);
    }
  }

  async function restoreFrom(fileName: string) {
    if (
      !confirm(
        `Restore data from this backup?\n\n${fileName}\n\nCurrent data will be saved as a safety backup first.`
      )
    ) {
      return;
    }
    setBackupBusy(true);
    setErr("");
    setMsg("");
    try {
      const res = await fetch("/api/backup", {
        method: "POST",
        headers: { "Content-Type": "application/json" },
        body: JSON.stringify({ action: "restore", fileName }),
      });
      const data = await res.json();
      if (!res.ok) throw new Error(data.error || "Restore failed");
      setMsg(data.message || "Restored. Reloading...");
      setBackupInfo({ ...data.status, backups: data.backups });
      setTimeout(() => window.location.reload(), 1200);
    } catch (e) {
      setErr(e instanceof Error ? e.message : "Restore failed");
    } finally {
      setBackupBusy(false);
    }
  }

  function downloadBackup(file?: string) {
    const q = file
      ? `/api/backup?download=1&file=${encodeURIComponent(file)}`
      : "/api/backup?download=1";
    window.location.href = q;
  }

  function formatBytes(n?: number) {
    if (!n) return "0 KB";
    if (n < 1024 * 1024) return `${(n / 1024).toFixed(1)} KB`;
    return `${(n / (1024 * 1024)).toFixed(2)} MB`;
  }

  async function checkUpdates(showMsg = true) {
    setChecking(true);
    setErr("");
    if (showMsg) setMsg("");
    try {
      const res = await fetch("/api/updates");
      const data = await res.json();
      setUpdateInfo(data);
      if (data.remoteUrl) setRemoteUrl(data.remoteUrl);
      if (showMsg) setMsg(data.message || "Checked");
    } catch (e) {
      setErr(e instanceof Error ? e.message : "Check failed");
    } finally {
      setChecking(false);
    }
  }

  async function applyUpdates() {
    if (!confirm("Update will download and install. Your data (sales/stock) will stay safe. Continue?")) {
      return;
    }
    setApplying(true);
    setErr("");
    setMsg("Applying update... this may take 1-2 minutes.");
    try {
      const res = await fetch("/api/updates", {
        method: "POST",
        headers: { "Content-Type": "application/json" },
        body: JSON.stringify({ action: "apply" }),
      });
      const data = await res.json();
      if (!res.ok) throw new Error(data.error || "Update fail");
      setMsg(data.message || "Update applied");
      await checkUpdates(false);
    } catch (e) {
      setErr(e instanceof Error ? e.message : "Update failed");
    } finally {
      setApplying(false);
    }
  }

  async function saveRemote() {
    setSaving(true);
    setErr("");
    setMsg("");
    try {
      const res = await fetch("/api/updates", {
        method: "POST",
        headers: { "Content-Type": "application/json" },
        body: JSON.stringify({ action: "set_remote", url: remoteUrl }),
      });
      const data = await res.json();
      if (!res.ok) throw new Error(data.error || "Failed");
      setMsg(data.message || "Remote saved");
      await checkUpdates(false);
    } catch (e) {
      setErr(e instanceof Error ? e.message : "Error");
    } finally {
      setSaving(false);
    }
  }

  async function saveCompany(e: FormEvent) {
    e.preventDefault();
    setSaving(true);
    setMsg("");
    setErr("");
    try {
      const res = await fetch("/api/settings", {
        method: "PUT",
        headers: { "Content-Type": "application/json" },
        body: JSON.stringify({ section: "company", ...company }),
      });
      const data = await res.json();
      if (!res.ok) throw new Error(data.error || "Failed");
      setMsg("Company info saved");
    } catch (e) {
      setErr(e instanceof Error ? e.message : "Error");
    } finally {
      setSaving(false);
    }
  }

  async function savePassword(e: FormEvent) {
    e.preventDefault();
    setMsg("");
    setErr("");
    if (pwd.new_password !== pwd.confirm) {
      setErr("Login passwords do not match");
      return;
    }
    setSaving(true);
    try {
      const res = await fetch("/api/settings", {
        method: "PUT",
        headers: { "Content-Type": "application/json" },
        body: JSON.stringify({
          section: "login_password",
          current_password: pwd.current_password,
          new_password: pwd.new_password,
        }),
      });
      const data = await res.json();
      if (!res.ok) throw new Error(data.error || "Failed");
      setMsg("Login password updated");
      setPwd({ current_password: "", new_password: "", confirm: "" });
    } catch (e) {
      setErr(e instanceof Error ? e.message : "Error");
    } finally {
      setSaving(false);
    }
  }

  async function saveSettingsPassword(e: FormEvent) {
    e.preventDefault();
    setMsg("");
    setErr("");
    if (settingsPwd.new_password !== settingsPwd.confirm) {
      setErr("Settings passwords do not match");
      return;
    }
    setSavingSettingsPwd(true);
    try {
      const res = await fetch("/api/settings", {
        method: "PUT",
        headers: { "Content-Type": "application/json" },
        body: JSON.stringify({
          section: "settings_password",
          current_password: settingsPwd.current_password,
          new_password: settingsPwd.new_password,
        }),
      });
      const data = await res.json();
      if (!res.ok) throw new Error(data.error || "Failed");
      setMsg("Settings password updated");
      setSettingsPwd({ current_password: "", new_password: "", confirm: "" });
    } catch (e) {
      setErr(e instanceof Error ? e.message : "Error");
    } finally {
      setSavingSettingsPwd(false);
    }
  }

  const tabs = [
    { id: "sync" as const, label: "Sync", icon: RefreshCcw },
    { id: "appearance" as const, label: "Appearance", icon: Palette },
    { id: "company" as const, label: "Company Info", icon: Building2 },
    { id: "password" as const, label: "Password", icon: KeyRound },
    { id: "backup" as const, label: "Backup", icon: HardDrive },
    { id: "updates" as const, label: "Updates", icon: RefreshCw },
  ];

  if (!unlocked) {
    return (
      <div>
        <PageHeader title="Settings" subtitle="Enter settings password" />
        <Card title="Unlock Settings">
          <form onSubmit={unlockSettings} className="mx-auto max-w-md space-y-4 p-5">
            <Input
              label="Settings password"
              type="password"
              required
              autoFocus
              value={gatePassword}
              onChange={(e) => setGatePassword(e.target.value)}
              placeholder="Settings password"
            />
            {gateError && <p className="text-sm text-rose-500">{gateError}</p>}
            <Button type="submit" className="w-full" disabled={gateLoading}>
              <KeyRound size={16} />
              {gateLoading ? "Checking..." : "Unlock"}
            </Button>
          </form>
        </Card>
      </div>
    );
  }

  return (
    <div>
      <PageHeader
        title="Settings"
        subtitle="Administration"
        action={
          <Button type="button" variant="secondary" onClick={() => setUnlocked(false)}>
            <KeyRound size={16} /> Lock
          </Button>
        }
      />

      <div className="mb-5 flex flex-wrap gap-2">
        {tabs.map((t) => (
          <button
            key={t.id}
            type="button"
            onClick={() => {
              setTab(t.id);
              setMsg("");
              setErr("");
            }}
            className={`inline-flex items-center gap-2 rounded-xl px-4 py-2.5 text-sm font-semibold transition ${
              tab === t.id
                ? "bg-brand-600 text-white shadow-sm"
                : "bg-surface-card text-muted shadow-soft hover:bg-surface-muted"
            }`}
          >
            <t.icon size={16} />
            {t.label}
          </button>
        ))}
      </div>

      {(msg || err) && (
        <p className={`mb-4 text-sm ${err ? "text-rose-500" : "text-emerald-600"}`}>{err || msg}</p>
      )}

      {tab === "appearance" && (
        <Card title="Theme">
          <div className="p-5">
            <ThemeSwitcher />
          </div>
        </Card>
      )}

      {tab === "sync" && (
        <Card title="Sync">
          <div className="space-y-3 p-5">
            <Input
              label="PC name"
              value={deviceName}
              onChange={(e) => setDeviceNameInput(e.target.value)}
              placeholder="Office PC or Home PC"
            />
            <Input
              label="GitHub token"
              type="password"
              value={syncToken}
              onChange={(e) => setSyncTokenInput(e.target.value)}
              placeholder={syncInfo?.hasToken ? "Token saved — leave blank to keep" : "ghp_..."}
            />
            <div className="flex flex-wrap gap-2">
              <Button onClick={saveSyncSettings} disabled={syncBusy} variant="secondary">
                <Save size={16} /> Save
              </Button>
              <Button onClick={runSyncNow} disabled={syncBusy}>
                <RefreshCcw size={16} className={syncBusy ? "animate-spin" : ""} />
                {syncBusy ? "Syncing..." : "Sync Now"}
              </Button>
            </div>
            <div className="rounded-xl bg-surface-muted p-3 text-sm text-muted">
              <p>
                <strong className="text-ink">Connected:</strong>{" "}
                {syncInfo?.hasRemote ? syncInfo.remoteUrl || "Yes" : "Not set"}
              </p>
              <p className="mt-1">
                <strong className="text-ink">Last sync:</strong>{" "}
                {syncInfo?.lastSyncAt
                  ? new Date(syncInfo.lastSyncAt).toLocaleString()
                  : "Not yet"}
              </p>
            </div>
          </div>
        </Card>
      )}

      {tab === "company" && (
        <Card title="Company Information">
          <form onSubmit={saveCompany} className="space-y-3 p-5">
            <div className="grid gap-3 sm:grid-cols-2">
              <Input
                label="Company Name"
                required
                value={company.name}
                onChange={(e) => setCompany({ ...company, name: e.target.value })}
              />
              <Input
                label="Owner Name"
                value={company.owner_name}
                onChange={(e) => setCompany({ ...company, owner_name: e.target.value })}
              />
              <Input
                label="Phone / Number"
                value={company.phone}
                onChange={(e) => setCompany({ ...company, phone: e.target.value })}
              />
              <Input
                label="Email"
                value={company.email}
                onChange={(e) => setCompany({ ...company, email: e.target.value })}
              />
              <Input
                label="City"
                value={company.city}
                onChange={(e) => setCompany({ ...company, city: e.target.value })}
              />
              <Input
                label="NTN"
                value={company.ntn}
                onChange={(e) => setCompany({ ...company, ntn: e.target.value })}
              />
            </div>
            <TextArea
              label="Address"
              value={company.address}
              onChange={(e) => setCompany({ ...company, address: e.target.value })}
            />
            <div className="flex justify-end">
              <Button type="submit" disabled={saving}>
                {saving ? "Saving..." : "Save Company Info"}
              </Button>
            </div>
          </form>
        </Card>
      )}

      {tab === "password" && (
        <div className="grid gap-4 lg:grid-cols-2">
          <Card title="Login password">
            <form onSubmit={savePassword} className="space-y-3 p-5">
              <Input
                label="Current login password"
                type="password"
                required
                value={pwd.current_password}
                onChange={(e) => setPwd({ ...pwd, current_password: e.target.value })}
              />
              <Input
                label="New login password"
                type="password"
                required
                value={pwd.new_password}
                onChange={(e) => setPwd({ ...pwd, new_password: e.target.value })}
              />
              <Input
                label="Confirm new login password"
                type="password"
                required
                value={pwd.confirm}
                onChange={(e) => setPwd({ ...pwd, confirm: e.target.value })}
              />
              <Button type="submit" disabled={saving}>
                {saving ? "Saving..." : "Update login password"}
              </Button>
            </form>
          </Card>

          <Card title="Settings password">
            <form onSubmit={saveSettingsPassword} className="space-y-3 p-5">
              <Input
                label="Current settings password"
                type="password"
                required
                value={settingsPwd.current_password}
                onChange={(e) =>
                  setSettingsPwd({ ...settingsPwd, current_password: e.target.value })
                }
              />
              <Input
                label="New settings password"
                type="password"
                required
                value={settingsPwd.new_password}
                onChange={(e) => setSettingsPwd({ ...settingsPwd, new_password: e.target.value })}
              />
              <Input
                label="Confirm new settings password"
                type="password"
                required
                value={settingsPwd.confirm}
                onChange={(e) => setSettingsPwd({ ...settingsPwd, confirm: e.target.value })}
              />
              <Button type="submit" disabled={savingSettingsPwd}>
                {savingSettingsPwd ? "Saving..." : "Update settings password"}
              </Button>
            </form>
          </Card>
        </div>
      )}

      {tab === "backup" && (
        <div className="space-y-4">
          <Card title="Local backup">
            <div className="space-y-4 p-5">
              <div className="grid gap-3 sm:grid-cols-3">
                <div className="rounded-xl bg-surface-muted p-3">
                  <p className="text-xs font-semibold uppercase tracking-wide text-muted">Live data</p>
                  <p className="mt-1 text-lg font-bold text-ink">
                    {formatBytes(backupInfo?.liveDbSize)}
                  </p>
                </div>
                <div className="rounded-xl bg-surface-muted p-3">
                  <p className="text-xs font-semibold uppercase tracking-wide text-muted">
                    Saved backups
                  </p>
                  <p className="mt-1 text-lg font-bold text-ink">{backupInfo?.count ?? "…"}</p>
                </div>
                <div className="rounded-xl bg-surface-muted p-3">
                  <p className="text-xs font-semibold uppercase tracking-wide text-muted">
                    Last auto backup
                  </p>
                  <p className="mt-1 text-sm font-semibold text-ink">
                    {backupInfo?.lastAutoBackup
                      ? formatDate(backupInfo.lastAutoBackup.slice(0, 10))
                      : "Not yet"}
                  </p>
                </div>
              </div>

              <div className="flex flex-wrap gap-2">
                <Button onClick={createLocalBackup} disabled={backupBusy}>
                  <Save size={16} />
                  {backupBusy ? "Saving..." : "Save Backup Now"}
                </Button>
                <Button variant="secondary" onClick={() => downloadBackup()} disabled={backupBusy}>
                  <Download size={16} /> Download Current (.db)
                </Button>
                <Button variant="ghost" onClick={loadBackups} disabled={backupBusy}>
                  <RefreshCw size={16} /> Refresh List
                </Button>
              </div>

              {backupInfo?.docsBackupDir && (
                <p className="text-xs text-muted">Documents backup enabled</p>
              )}
            </div>
          </Card>

          <Card title="Backup history / Restore">
            <div className="p-5">
              {!backupInfo?.backups?.length ? (
                <p className="text-sm text-muted">
                  No backups yet. Click <strong>Save Backup Now</strong> or just keep using the app —
                  auto backup runs daily.
                </p>
              ) : (
                <div className="overflow-x-auto">
                  <table className="w-full min-w-[640px] text-left text-sm">
                    <thead>
                      <tr className="border-b border-edge text-xs uppercase tracking-wide text-muted">
                        <th className="py-2 pr-3">File</th>
                        <th className="py-2 pr-3">When</th>
                        <th className="py-2 pr-3">Size</th>
                        <th className="py-2 pr-3">Where</th>
                        <th className="py-2">Actions</th>
                      </tr>
                    </thead>
                    <tbody>
                      {backupInfo.backups.map((b) => (
                        <tr key={`${b.location}-${b.name}`} className="border-b border-edge/70">
                          <td className="py-2.5 pr-3 font-medium text-ink">
                            {b.name}
                            {b.name === "pepsi-day-one.db" && (
                              <span className="ml-2 rounded-full bg-brand-50 px-2 py-0.5 text-[10px] font-semibold uppercase text-brand-700">
                                Day One
                              </span>
                            )}
                          </td>
                          <td className="py-2.5 pr-3 text-muted">
                            {new Date(b.createdAt).toLocaleString()}
                          </td>
                          <td className="py-2.5 pr-3 text-muted">{formatBytes(b.size)}</td>
                          <td className="py-2.5 pr-3 text-muted">
                            {b.location === "documents" ? "Documents" : "App folder"}
                          </td>
                          <td className="py-2.5">
                            <div className="flex flex-wrap gap-1.5">
                              <Button
                                variant="secondary"
                                className="!px-2.5 !py-1.5 text-xs"
                                onClick={() => downloadBackup(b.name)}
                                disabled={backupBusy}
                              >
                                <Download size={14} /> Download
                              </Button>
                              <Button
                                variant="ghost"
                                className="!px-2.5 !py-1.5 text-xs"
                                onClick={() => restoreFrom(b.name)}
                                disabled={backupBusy}
                              >
                                <RotateCcw size={14} /> Restore
                              </Button>
                            </div>
                          </td>
                        </tr>
                      ))}
                    </tbody>
                  </table>
                </div>
              )}
            </div>
          </Card>
        </div>
      )}

      {tab === "updates" && (
        <div className="space-y-4">
          <Card title="Software updates">
            <div className="space-y-4 p-5">
              <div className="rounded-xl bg-surface-muted p-4 text-sm text-muted">
                <p>
                  <strong className="text-ink">Version:</strong> {updateInfo?.localVersion || "..."}
                </p>
                <p className="mt-1">{updateInfo?.message || "Click Check Updates"}</p>
              </div>
              <div className="flex flex-wrap gap-2">
                <Button onClick={() => checkUpdates(true)} disabled={checking || applying}>
                  <RefreshCw size={16} className={checking ? "animate-spin" : ""} />
                  {checking ? "Checking..." : "Check Updates"}
                </Button>
                <Button
                  onClick={applyUpdates}
                  disabled={applying || checking || updateInfo?.status === "up_to_date"}
                >
                  <CloudDownload size={16} />
                  {applying ? "Updating..." : "Apply Updates"}
                </Button>
              </div>
            </div>
          </Card>

          <Card title="GitHub URL">
            <div className="space-y-3 p-5">
              <Input
                label="GitHub Repo URL"
                placeholder="https://github.com/USERNAME/pepsi-distribution.git"
                value={remoteUrl}
                onChange={(e) => setRemoteUrl(e.target.value)}
              />
              <Button onClick={saveRemote} disabled={saving || !remoteUrl}>
                {saving ? "Saving..." : "Save"}
              </Button>
            </div>
          </Card>
        </div>
      )}
    </div>
  );
}
