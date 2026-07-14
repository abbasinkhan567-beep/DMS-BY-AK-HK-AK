"use client";

import { useEffect } from "react";

/** Daily backup + auto sync when online and a sync folder is configured. */
export function AutoBackupRunner() {
  useEffect(() => {
    const today = new Date().toISOString().slice(0, 10);

    async function ping() {
      try {
        const backupKey = "pepsi-auto-backup-ping";
        if (sessionStorage.getItem(backupKey) !== today) {
          sessionStorage.setItem(backupKey, today);
          await fetch("/api/backup", {
            method: "POST",
            headers: { "Content-Type": "application/json" },
            body: JSON.stringify({ action: "auto" }),
          });
        }
      } catch {
        /* offline / ignore */
      }

      try {
        if (!navigator.onLine) return;
        const syncKey = "pepsi-auto-sync-ping";
        const last = sessionStorage.getItem(syncKey);
        const hour = new Date().toISOString().slice(0, 13);
        if (last === hour) return;
        sessionStorage.setItem(syncKey, hour);
        await fetch("/api/sync", {
          method: "POST",
          headers: { "Content-Type": "application/json" },
          body: JSON.stringify({ action: "auto" }),
        });
      } catch {
        /* offline / ignore */
      }
    }

    ping();
    const onOnline = () => {
      try {
        sessionStorage.removeItem("pepsi-auto-sync-ping");
      } catch {
        /* ignore */
      }
      ping();
    };
    window.addEventListener("online", onOnline);
    const id = window.setInterval(() => {
      if (navigator.onLine) ping();
    }, 5 * 60 * 1000);

    return () => {
      window.removeEventListener("online", onOnline);
      window.clearInterval(id);
    };
  }, []);

  return null;
}
