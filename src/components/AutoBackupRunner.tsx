"use client";

import { useEffect } from "react";

/** Daily backup + merge-sync when online (both PCs keep all entries). */
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
        const slot = String(Math.floor(Date.now() / (2 * 60 * 1000)));
        const last = sessionStorage.getItem(syncKey);
        if (last === slot) return;
        sessionStorage.setItem(syncKey, slot);
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
    }, 2 * 60 * 1000);

    return () => {
      window.removeEventListener("online", onOnline);
      window.clearInterval(id);
    };
  }, []);

  return null;
}
