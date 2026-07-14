"use client";

import { useEffect, useRef, useState } from "react";
import { Check, Palette } from "lucide-react";
import { THEMES, useTheme, type ThemeId } from "@/components/ThemeProvider";

export function ThemeSwitcher({ compact = false }: { compact?: boolean }) {
  const { theme, setTheme } = useTheme();
  const [open, setOpen] = useState(false);
  const ref = useRef<HTMLDivElement>(null);

  useEffect(() => {
    function onClick(e: MouseEvent) {
      if (ref.current && !ref.current.contains(e.target as Node)) setOpen(false);
    }
    document.addEventListener("mousedown", onClick);
    return () => document.removeEventListener("mousedown", onClick);
  }, []);

  function pick(id: ThemeId) {
    setTheme(id);
    setOpen(false);
  }

  if (!compact) {
    return (
      <div className="grid gap-3 sm:grid-cols-3">
        {THEMES.map((t) => {
          const active = theme === t.id;
          return (
            <button
              key={t.id}
              type="button"
              onClick={() => setTheme(t.id)}
              className={`rounded-2xl border p-4 text-left transition ${
                active
                  ? "border-brand-500 bg-brand-50 ring-2 ring-brand-500/30"
                  : "border-edge bg-surface-card hover:border-brand-300"
              }`}
            >
              <div className="mb-3 flex gap-1.5">
                {t.swatches.map((c) => (
                  <span
                    key={c}
                    className="h-6 w-6 rounded-full border border-black/10 shadow-sm"
                    style={{ background: c }}
                  />
                ))}
              </div>
              <div className="flex items-center justify-between gap-2">
                <div>
                  <p className="font-semibold text-ink">{t.label}</p>
                  <p className="text-xs text-muted">{t.description}</p>
                </div>
                {active && (
                  <span className="inline-flex h-7 w-7 items-center justify-center rounded-full bg-brand-600 text-white">
                    <Check size={14} />
                  </span>
                )}
              </div>
            </button>
          );
        })}
      </div>
    );
  }

  return (
    <div className="relative" ref={ref}>
      <button
        type="button"
        onClick={() => setOpen((v) => !v)}
        className="relative rounded-full bg-surface-card p-2.5 text-muted shadow-soft hover:text-brand-600"
        aria-label="Theme"
        title="Theme"
      >
        <Palette size={18} />
      </button>

      {open && (
        <div className="absolute right-0 top-12 z-50 w-56 overflow-hidden rounded-2xl border border-edge bg-surface-card shadow-card">
          <p className="border-b border-edge px-3 py-2 text-[11px] font-semibold uppercase tracking-wide text-muted">
            Theme
          </p>
          <div className="p-1.5">
            {THEMES.map((t) => {
              const active = theme === t.id;
              return (
                <button
                  key={t.id}
                  type="button"
                  onClick={() => pick(t.id)}
                  className={`flex w-full items-center gap-3 rounded-xl px-2.5 py-2 text-left text-sm transition ${
                    active ? "bg-brand-50 text-brand-700" : "text-ink hover:bg-surface-muted"
                  }`}
                >
                  <span className="flex gap-0.5">
                    {t.swatches.map((c) => (
                      <span
                        key={c}
                        className="h-3.5 w-3.5 rounded-full border border-black/10"
                        style={{ background: c }}
                      />
                    ))}
                  </span>
                  <span className="flex-1 font-medium">{t.label}</span>
                  {active && <Check size={14} className="text-brand-600" />}
                </button>
              );
            })}
          </div>
        </div>
      )}
    </div>
  );
}
