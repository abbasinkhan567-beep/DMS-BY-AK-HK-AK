"use client";

import { FormEvent, ReactNode, useEffect, useRef, useState } from "react";
import { X } from "lucide-react";

type ModalProps = {
  open: boolean;
  title: string;
  onClose: () => void;
  children: ReactNode;
  wide?: boolean;
};

export function Modal({ open, title, onClose, children, wide }: ModalProps) {
  const ref = useRef<HTMLDivElement>(null);

  useEffect(() => {
    if (!open) return;
    const handler = (e: KeyboardEvent) => {
      if (e.key === "Escape") onClose();
    };
    document.addEventListener("keydown", handler);
    return () => document.removeEventListener("keydown", handler);
  }, [open, onClose]);

  if (!open) return null;
  return (
    <div
      className="fixed inset-0 z-[60] flex items-start justify-center overflow-y-auto bg-slate-900/40 p-4 pt-10 backdrop-blur-[2px] sm:pt-16"
      onClick={(e) => { if (e.target === e.currentTarget) onClose(); }}
    >
      <div ref={ref} className={`w-full rounded-2xl bg-surface-card shadow-2xl ${wide ? "max-w-3xl" : "max-w-lg"}`}>
        <div className="flex items-center justify-between border-b border-edge px-5 py-4">
          <h2 className="text-lg font-semibold text-ink">{title}</h2>
          <button
            type="button"
            onClick={onClose}
            className="rounded-lg p-1 text-muted hover:bg-surface-muted hover:text-ink"
            aria-label="Close"
          >
            <X size={18} />
          </button>
        </div>
        <div className="px-5 py-4">{children}</div>
      </div>
    </div>
  );
}

export function PageHeader({
  title,
  subtitle,
  action,
}: {
  title: string;
  subtitle?: string;
  action?: ReactNode;
}) {
  return (
    <div className="mb-5 flex flex-col gap-3 sm:flex-row sm:items-center sm:justify-between">
      <div>
        <h1 className="text-xl font-bold text-ink sm:text-2xl">{title}</h1>
        {subtitle && <p className="mt-0.5 text-sm text-muted">{subtitle}</p>}
      </div>
      {action}
    </div>
  );
}

export function Card({
  children,
  className = "",
  title,
  action,
}: {
  children: ReactNode;
  className?: string;
  title?: string;
  action?: ReactNode;
}) {
  return (
    <section className={`card ${className}`}>
      {(title || action) && (
        <div className="flex items-center justify-between border-b border-edge px-5 py-4">
          {title && <h2 className="text-base font-semibold text-ink">{title}</h2>}
          {action}
        </div>
      )}
      {children}
    </section>
  );
}

export function Button({
  children,
  variant = "primary",
  className = "",
  ...props
}: React.ButtonHTMLAttributes<HTMLButtonElement> & {
  variant?: "primary" | "secondary" | "danger" | "ghost";
}) {
  const styles = {
    primary: "bg-brand-600 text-white hover:bg-brand-700 shadow-sm",
    secondary: "bg-surface-card text-ink border border-edge hover:bg-surface-muted",
    danger: "bg-rose-500 text-white hover:bg-rose-600",
    ghost: "bg-transparent text-muted hover:bg-surface-muted hover:text-ink",
  };
  return (
    <button
      type="button"
      className={`inline-flex items-center justify-center gap-2 rounded-xl px-4 py-2.5 text-sm font-semibold transition disabled:opacity-50 ${styles[variant]} ${className}`}
      {...props}
    >
      {children}
    </button>
  );
}

export function Input({
  label,
  className = "",
  ...props
}: React.InputHTMLAttributes<HTMLInputElement> & { label?: string }) {
  return (
    <label className="block space-y-1.5">
      {label && (
        <span className="text-xs font-semibold text-muted">{label}</span>
      )}
      <input
        className={`w-full rounded-xl border border-edge bg-surface-card px-3.5 py-2.5 text-sm text-ink outline-none ring-brand-400 placeholder:text-muted focus:border-brand-400 focus:ring-2 ${className}`}
        {...props}
      />
    </label>
  );
}

export function Select({
  label,
  children,
  className = "",
  ...props
}: React.SelectHTMLAttributes<HTMLSelectElement> & { label?: string }) {
  return (
    <label className="block space-y-1.5">
      {label && (
        <span className="text-xs font-semibold text-muted">{label}</span>
      )}
      <select
        className={`w-full rounded-xl border border-edge bg-surface-card px-3.5 py-2.5 text-sm text-ink outline-none ring-brand-400 focus:border-brand-400 focus:ring-2 ${className}`}
        {...props}
      >
        {children}
      </select>
    </label>
  );
}

export function TextArea({
  label,
  className = "",
  ...props
}: React.TextareaHTMLAttributes<HTMLTextAreaElement> & { label?: string }) {
  return (
    <label className="block space-y-1.5">
      {label && (
        <span className="text-xs font-semibold text-muted">{label}</span>
      )}
      <textarea
        className={`w-full rounded-xl border border-edge bg-surface-card px-3.5 py-2.5 text-sm text-ink outline-none ring-brand-400 focus:border-brand-400 focus:ring-2 ${className}`}
        rows={3}
        {...props}
      />
    </label>
  );
}

export function EmptyState({ message }: { message: string }) {
  return (
    <div className="card px-6 py-14 text-center text-sm text-muted">
      {message}
    </div>
  );
}

export function StatusPill({
  children,
  tone = "green",
}: {
  children: ReactNode;
  tone?: "green" | "amber" | "orange" | "red" | "blue" | "slate";
}) {
  const tones = {
    green: "bg-emerald-50 text-emerald-600 dark:bg-emerald-500/15 dark:text-emerald-400",
    amber: "bg-amber-50 text-amber-600 dark:bg-amber-500/15 dark:text-amber-400",
    orange: "bg-orange-50 text-orange-500 dark:bg-orange-500/15 dark:text-orange-400",
    red: "bg-rose-50 text-rose-600 dark:bg-rose-500/15 dark:text-rose-400",
    blue: "bg-sky-50 text-sky-600 dark:bg-sky-500/15 dark:text-sky-400",
    slate: "bg-surface-muted text-muted",
  };
  return <span className={`status-pill ${tones[tone]}`}>{children}</span>;
}

export function DataTable({
  headers,
  children,
}: {
  headers: string[];
  children: ReactNode;
}) {
  return (
    <div className="overflow-x-auto">
      <table className="w-full min-w-[720px] text-left text-sm">
        <thead>
          <tr className="border-b border-edge">
            {headers.map((h) => (
              <th
                key={h}
                className="px-5 py-3 text-xs font-semibold uppercase tracking-wide text-muted"
              >
                {h}
              </th>
            ))}
          </tr>
        </thead>
        <tbody>{children}</tbody>
      </table>
    </div>
  );
}

export function useAsyncSubmit() {
  const [loading, setLoading] = useState(false);
  const [error, setError] = useState("");

  async function submit(e: FormEvent, fn: () => Promise<void>) {
    e.preventDefault();
    setLoading(true);
    setError("");
    try {
      await fn();
    } catch (err) {
      setError(err instanceof Error ? err.message : "Something went wrong");
    } finally {
      setLoading(false);
    }
  }

  return { loading, error, setError, submit };
}
