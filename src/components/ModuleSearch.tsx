"use client";

import { Search, X } from "lucide-react";
import { Button } from "@/components/ui";

export function ModuleSearch({
  value,
  onChange,
  placeholder = "Search by name...",
  onClear,
}: {
  value: string;
  onChange: (v: string) => void;
  placeholder?: string;
  onClear?: () => void;
}) {
  return (
    <div className="mb-4 flex flex-col gap-2 sm:flex-row sm:items-center">
      <div className="relative w-full max-w-md flex-1">
        <Search
          size={16}
          className="pointer-events-none absolute left-3.5 top-1/2 -translate-y-1/2 text-muted"
        />
        <input
          type="search"
          value={value}
          onChange={(e) => onChange(e.target.value)}
          placeholder={placeholder}
          className="w-full rounded-xl border border-edge bg-surface-card py-2.5 pl-10 pr-10 text-sm text-ink outline-none ring-brand-400 placeholder:text-muted focus:border-brand-400 focus:ring-2"
        />
        {value ? (
          <button
            type="button"
            className="absolute right-3 top-1/2 -translate-y-1/2 rounded p-0.5 text-muted hover:text-ink"
            onClick={() => {
              onChange("");
              onClear?.();
            }}
            aria-label="Clear search"
          >
            <X size={16} />
          </button>
        ) : null}
      </div>
      <Button type="button" variant="secondary" className="shrink-0">
        <Search size={16} /> Search
      </Button>
    </div>
  );
}

export function matchSearch(haystack: string, query: string) {
  const q = query.trim().toLowerCase();
  if (!q) return true;
  return haystack.toLowerCase().includes(q);
}
