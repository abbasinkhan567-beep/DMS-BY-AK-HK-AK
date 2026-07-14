"use client";

import Link from "next/link";
import { useRouter } from "next/navigation";
import { LogOut, Settings } from "lucide-react";
import { ThemeSwitcher } from "@/components/ThemeSwitcher";
import { useTheme } from "@/components/ThemeProvider";

export function TopHeader() {
  const { theme } = useTheme();
  const router = useRouter();

  async function logout() {
    await fetch("/api/auth/logout", { method: "POST" });
    router.replace("/login");
    router.refresh();
  }

  return (
    <header
      className="sticky top-0 z-30 flex items-center justify-end gap-3 border-b border-edge px-4 py-3 backdrop-blur-md sm:px-6 lg:px-8"
      style={{ background: "var(--header)" }}
    >
      <div className="mr-auto hidden items-center gap-2 pl-12 lg:flex lg:pl-0">
        {theme === "pepsi" && (
          <span className="pepsi-stripe h-2 w-8 rounded-full" aria-hidden />
        )}
        <span className="text-sm font-semibold text-ink">Pepsi Distribution</span>
      </div>

      <ThemeSwitcher compact />

      <Link
        href="/settings"
        className="inline-flex rounded-full bg-surface-card p-2.5 text-muted shadow-soft hover:text-brand-600"
        aria-label="Settings"
      >
        <Settings size={18} />
      </Link>

      <button
        type="button"
        onClick={logout}
        className="inline-flex rounded-full bg-surface-card p-2.5 text-muted shadow-soft hover:text-rose-500"
        aria-label="Log out"
        title="Log out"
      >
        <LogOut size={18} />
      </button>

      <div className="flex items-center gap-2.5 rounded-full bg-surface-card py-1.5 pl-1.5 pr-3 shadow-soft sm:pr-4">
        <span className="inline-flex h-9 w-9 items-center justify-center rounded-full bg-brand-600 text-sm font-bold text-white">
          A
        </span>
        <div className="hidden leading-tight sm:block">
          <p className="text-sm font-semibold text-ink">Admin</p>
          <p className="text-[11px] text-muted">Administrator</p>
        </div>
      </div>
    </header>
  );
}
