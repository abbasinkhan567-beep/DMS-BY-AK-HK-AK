"use client";

import { FormEvent, ReactNode, useEffect, useRef, useState } from "react";
import { X, ChevronDown, Printer, Download, FileText, Plus, Search, Filter, MoreHorizontal } from "lucide-react";

type ModalProps = {
  open: boolean;
  title: string;
  onClose: () => void;
  children: ReactNode;
  wide?: boolean;
  full?: boolean;
};

export function Modal({ open, title, onClose, children, wide, full }: ModalProps) {
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
      role="dialog"
      aria-modal="true"
      aria-labelledby="modal-title"
    >
      <div
        ref={ref}
        data-modal
        className={`w-full rounded-2xl bg-surface-card shadow-2xl animate-scale-in ${wide ? "max-w-4xl" : full ? "max-w-[95vw]" : "max-w-lg"}`}
      >
        <div className="flex items-center justify-between border-b border-edge px-6 py-4 bg-surface-muted/50">
          <h2 id="modal-title" className="text-lg font-bold text-ink">{title}</h2>
          <button
            type="button"
            data-modal-close
            onClick={onClose}
            className="rounded-xl p-2 text-muted hover:bg-surface-muted hover:text-ink transition-all"
            aria-label="Close"
          >
            <X size={20} />
          </button>
        </div>
        <div className="px-6 py-5">{children}</div>
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
    <div className="mb-6 flex flex-col gap-3 sm:flex-row sm:items-center sm:justify-between animate-fade-in">
      <div>
        <h1 className="text-2xl font-bold text-ink sm:text-3xl tracking-tight">{title}</h1>
        {subtitle && <p className="mt-1 text-sm text-muted">{subtitle}</p>}
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
        <div className="flex items-center justify-between border-b border-edge px-6 py-4 bg-surface-muted/50">
          {title && <h2 className="text-base font-semibold text-ink">{title}</h2>}
          {action}
        </div>
      )}
      <div className="p-6">{children}</div>
    </section>
  );
}

export function Button({
  children,
  variant = "primary",
  className = "",
  icon,
  iconRight,
  loading = false,
  ...props
}: React.ButtonHTMLAttributes<HTMLButtonElement> & {
  variant?: "primary" | "secondary" | "danger" | "ghost" | "outline";
  icon?: ReactNode;
  iconRight?: ReactNode;
  loading?: boolean;
}) {
  const styles = {
    primary: "btn-primary",
    secondary: "btn-secondary",
    danger: "btn-danger",
    ghost: "btn-ghost",
    outline: "btn-secondary border-2 border-brand-300 text-brand-700 hover:bg-brand-50 dark:hover:bg-brand-900/30",
  };
  return (
    <button
      type="button"
      className={`inline-flex items-center justify-center gap-2 ${styles[variant]} ${className}`}
      disabled={loading || props.disabled}
      {...props}
    >
      {loading ? (
        <svg className="animate-spin h-5 w-5" viewBox="0 0 24 24">
          <circle className="opacity-25" cx="12" cy="12" r="10" stroke="currentColor" strokeWidth="3" fill="none" />
          <path className="opacity-75" fill="currentColor" d="M4 12a8 8 0 018-8V0C5.373 0 0 5.373 0 12h4zm2 5.291A7.962 7.962 0 014 12H0c0 3.042 1.135 5.824 3 7.938l3-2.647z" />
        </svg>
      ) : (
        icon
      )}
      {children}
      {iconRight && !loading}
    </button>
  );
}

export function Input({
  label,
  className = "",
  error,
  hint,
  icon,
  ...props
}: React.InputHTMLAttributes<HTMLInputElement> & { label?: string; error?: string; hint?: string; icon?: ReactNode }) {
  const [focused, setFocused] = useState(false);
  return (
    <label className="block space-y-1.5 w-full">
      {label && <span className="label-modern">{label}</span>}
      <div className="relative">
        {icon && (
          <div className="absolute left-4 top-1/2 -translate-y-1/2 text-muted pointer-events-none">
            {icon}
          </div>
        )}
        <input
          className={`input-modern ${icon ? "pl-12" : ""} ${error ? "border-rose-400 focus:border-rose-400" : ""} ${focused ? "ring-2 ring-brand-400/30" : ""} ${className}`}
          onFocus={() => setFocused(true)}
          onBlur={() => setFocused(false)}
          aria-invalid={error ? "true" : "false"}
          aria-describedby={error ? "error-msg" : hint ? "hint-msg" : undefined}
          {...props}
        />
      </div>
      {error && <p id="error-msg" className="text-xs text-rose-500 flex items-center gap-1"><span className="w-1.5 h-1.5 rounded-full bg-rose-500" /> {error}</p>}
      {hint && !error && <p id="hint-msg" className="text-xs text-muted">{hint}</p>}
    </label>
  );
}

export function Select({
  label,
  children,
  className = "",
  error,
  hint,
  placeholder,
  ...props
}: React.SelectHTMLAttributes<HTMLSelectElement> & { label?: string; error?: string; hint?: string; placeholder?: string }) {
  const [focused, setFocused] = useState(false);
  return (
    <label className="block space-y-1.5 w-full">
      {label && <span className="label-modern">{label}</span>}
      <div className="relative">
        <select
          className={`select-modern pr-10 ${error ? "border-rose-400 focus:border-rose-400" : ""} ${focused ? "ring-2 ring-brand-400/30" : ""} ${className}`}
          onFocus={() => setFocused(true)}
          onBlur={() => setFocused(false)}
          aria-invalid={error ? "true" : "false"}
          aria-describedby={error ? "error-msg" : hint ? "hint-msg" : undefined}
          {...props}
        >
          {placeholder && <option value="" disabled>{placeholder}</option>}
          {children}
        </select>
        <ChevronDown className="absolute right-4 top-1/2 -translate-y-1/2 text-muted pointer-events-none" size={18} />
      </div>
      {error && <p id="error-msg" className="text-xs text-rose-500 flex items-center gap-1"><span className="w-1.5 h-1.5 rounded-full bg-rose-500" /> {error}</p>}
      {hint && !error && <p id="hint-msg" className="text-xs text-muted">{hint}</p>}
    </label>
  );
}

export function TextArea({
  label,
  className = "",
  error,
  hint,
  ...props
}: React.TextareaHTMLAttributes<HTMLTextAreaElement> & { label?: string; error?: string; hint?: string }) {
  const [focused, setFocused] = useState(false);
  return (
    <label className="block space-y-1.5 w-full">
      {label && <span className="label-modern">{label}</span>}
      <textarea
        className={`input-modern resize-y min-h-[80px] ${error ? "border-rose-400 focus:border-rose-400" : ""} ${focused ? "ring-2 ring-brand-400/30" : ""} ${className}`}
        onFocus={() => setFocused(true)}
        onBlur={() => setFocused(false)}
        aria-invalid={error ? "true" : "false"}
        aria-describedby={error ? "error-msg" : hint ? "hint-msg" : undefined}
        {...props}
      />
      {error && <p id="error-msg" className="text-xs text-rose-500 flex items-center gap-1"><span className="w-1.5 h-1.5 rounded-full bg-rose-500" /> {error}</p>}
      {hint && !error && <p id="hint-msg" className="text-xs text-muted">{hint}</p>}
    </label>
  );
}

export function EmptyState({ message, icon }: { message: string; icon?: ReactNode }) {
  return (
    <div className="card-glass px-8 py-16 text-center text-sm text-muted animate-fade-in">
      {icon && <div className="mb-4 text-muted/50">{icon}</div>}
      <p className="font-medium text-ink mb-1">{message}</p>
    </div>
  );
}

export function StatusPill({
  children,
  tone = "green",
}: {
  children: ReactNode;
  tone?: "green" | "amber" | "orange" | "red" | "blue" | "slate" | "brand";
}) {
  const tones = {
    green: "bg-emerald-50 text-emerald-700 dark:bg-emerald-500/15 dark:text-emerald-400",
    amber: "bg-amber-50 text-amber-700 dark:bg-amber-500/15 dark:text-amber-400",
    orange: "bg-orange-50 text-orange-700 dark:bg-orange-500/15 dark:text-orange-400",
    red: "bg-rose-50 text-rose-700 dark:bg-rose-500/15 dark:text-rose-400",
    blue: "bg-sky-50 text-sky-700 dark:bg-sky-500/15 dark:text-sky-400",
    slate: "bg-surface-muted text-muted",
    brand: "bg-brand-50 text-brand-700 dark:bg-brand-500/15 dark:text-brand-400",
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
          <tr className="border-b border-edge bg-surface-muted/50">
            {headers.map((h) => (
              <th key={h} className="px-5 py-3 text-xs font-bold uppercase tracking-wider text-muted">
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

export function ModuleSearch({
  value,
  onChange,
  placeholder = "Search...",
  onClear,
}: {
  value: string;
  onChange: (v: string) => void;
  placeholder?: string;
  onClear?: () => void;
}) {
  return (
    <div className="relative max-w-xs sm:max-w-md mb-5 animate-fade-in">
      <Search className="absolute left-4 top-1/2 -translate-y-1/2 text-muted" size={18} />
      <input
        type="text"
        value={value}
        onChange={(e) => onChange(e.target.value)}
        placeholder={placeholder}
        className="input-modern pl-12 pr-12"
        aria-label="Search"
      />
      {value && (
        <button
          onClick={() => onChange("")}
          className="absolute right-4 top-1/2 -translate-y-1/2 text-muted hover:text-ink transition-colors"
          aria-label="Clear search"
        >
          <X size={16} />
        </button>
      )}
    </div>
  );
}

export function ActionButton({
  children,
  onClick,
  variant = "ghost",
  icon,
  tooltip,
  className = "",
  disabled,
}: {
  children?: ReactNode;
  onClick: () => void;
  variant?: "primary" | "secondary" | "ghost" | "danger";
  icon?: ReactNode;
  tooltip?: string;
  className?: string;
  disabled?: boolean;
}) {
  const styles = {
    primary: "btn-primary",
    secondary: "btn-secondary",
    ghost: "btn-ghost",
    danger: "btn-danger",
  };
  const content = (
    <Button variant={variant} onClick={onClick} disabled={disabled} className={`!px-3 !py-2 ${className}`}>
      {icon}
      {children}
    </Button>
  );
  if (tooltip) {
    return (
      <div className="relative inline-block" data-tooltip={tooltip}>
        {content}
      </div>
    );
  }
  return content;
}

export function PrintButton({
  onClick,
  disabled,
  className = "",
}: {
  onClick: () => void;
  disabled?: boolean;
  className?: string;
}) {
  return (
    <ActionButton
      icon={<Printer size={16} />}
      onClick={onClick}
      disabled={disabled}
      tooltip="Print (Ctrl+P)"
      className={className}
      variant="ghost"
    />
  );
}

export function ExcelButton({
  onClick,
  disabled,
  className = "",
}: {
  onClick: () => void;
  disabled?: boolean;
  className?: string;
}) {
  return (
    <ActionButton
      icon={<Download size={16} />}
      onClick={onClick}
      disabled={disabled}
      tooltip="Export Excel (Ctrl+E)"
      className={className}
      variant="ghost"
    />
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

export function useKeyboardNavigation({
  rows,
  cols,
  onNavigate,
  onAction,
  onEscape,
}: {
  rows: number;
  cols: number;
  onNavigate: (row: number, col: number) => void;
  onAction?: (row: number, col: number, key: string) => void;
  onEscape?: () => void;
}) {
  useEffect(() => {
    const handler = (e: KeyboardEvent) => {
      if (e.target instanceof HTMLInputElement || e.target instanceof HTMLTextAreaElement || e.target instanceof HTMLSelectElement) {
        if (e.key === "Enter" && !e.shiftKey && !(e.target instanceof HTMLTextAreaElement)) {
          e.preventDefault();
          // Handled by individual inputs
        }
        return;
      }

      // Global escape
      if (e.key === "Escape") {
        onEscape?.();
        return;
      }
    };
    document.addEventListener("keydown", handler);
    return () => document.removeEventListener("keydown", handler);
  }, [onEscape]);
}