"use client";

import { useEffect } from "react";
import { todayLocal } from "@/lib/utils";

/** Daily backup + merge-sync when online (both PCs keep all entries). */
export function AutoBackupRunner() {
  useEffect(() => {
    const today = todayLocal();

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
        const response = await fetch("/api/sync", {
          method: "POST",
          headers: { "Content-Type": "application/json" },
          body: JSON.stringify({ action: "auto" }),
        });
        const result = (await response.json().catch(() => null)) as
          | { ok?: boolean; skipped?: boolean }
          | null;
        if (response.ok && result?.ok !== false) {
          sessionStorage.setItem(syncKey, slot);
        }
      } catch {
        // Retry on the next interval if the server or GitHub is unavailable.
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
