export function formatMoney(amount: number) {
  return new Intl.NumberFormat("en-PK", {
    style: "currency",
    currency: "PKR",
    maximumFractionDigits: 0,
  }).format(amount || 0);
}

export function formatDate(dateStr: string) {
  if (!dateStr) return "-";
  const d = new Date(dateStr);
  if (Number.isNaN(d.getTime())) return dateStr;
  return d.toLocaleDateString("en-GB", {
    day: "2-digit",
    month: "short",
    year: "numeric",
  });
}

export function cn(...classes: Array<string | false | null | undefined>) {
  return classes.filter(Boolean).join(" ");
}

/** Safe JSON from fetch — avoids "Unexpected end of JSON input" on empty bodies. */
export async function readJson<T = unknown>(res: Response): Promise<T> {
  const text = await res.text();
  if (!text.trim()) {
    throw new Error(res.ok ? "Empty server response" : `Server error (${res.status})`);
  }
  try {
    return JSON.parse(text) as T;
  } catch {
    throw new Error(res.ok ? "Invalid server response" : `Server error (${res.status})`);
  }
}

export const ACCOUNT_TYPES = [
  { value: "supplier", label: "Supplier" },
  { value: "customer", label: "Customer" },
  { value: "bank", label: "Bank" },
  { value: "expense", label: "Expense" },
  { value: "counter", label: "Counter" },
  { value: "employee", label: "Employee" },
  { value: "general", label: "General Account" },
  { value: "salesman", label: "Salesman" },
] as const;

export function downloadCsv(filename: string, rows: Array<Record<string, unknown>>) {
  if (!rows.length) return;
  const headers = Object.keys(rows[0]);
  const escape = (v: unknown) => {
    const s = String(v ?? "");
    if (s.includes(",") || s.includes('"') || s.includes("\n")) {
      return `"${s.replace(/"/g, '""')}"`;
    }
    return s;
  };
  const csv = [headers.join(","), ...rows.map((r) => headers.map((h) => escape(r[h])).join(","))].join(
    "\n"
  );
  const blob = new Blob([csv], { type: "text/csv;charset=utf-8;" });
  const url = URL.createObjectURL(blob);
  const a = document.createElement("a");
  a.href = url;
  a.download = filename.endsWith(".csv") ? filename : `${filename}.csv`;
  a.click();
  URL.revokeObjectURL(url);
}

export function printHtml(title: string, bodyHtml: string) {
  const win = window.open("", "_blank", "width=900,height=700");
  if (!win) return;
  win.document.write(`<!DOCTYPE html><html><head><title>${title}</title>
    <style>
      body{font-family:Segoe UI,Arial,sans-serif;padding:24px;color:#0f172a}
      h1{font-size:20px;margin:0 0 4px}
      h2{font-size:14px;color:#64748b;font-weight:500;margin:0 0 16px}
      table{width:100%;border-collapse:collapse;margin-top:12px;font-size:13px}
      th,td{border:1px solid #e2e8f0;padding:8px;text-align:left}
      th{background:#f8fafc}
      .meta{display:grid;grid-template-columns:1fr 1fr;gap:8px;font-size:13px;margin-bottom:12px}
      .totals{margin-top:16px;width:280px;margin-left:auto}
      .totals div{display:flex;justify-content:space-between;padding:4px 0;font-size:13px}
      .totals .grand{font-weight:700;border-top:2px solid #0f172a;margin-top:6px;padding-top:8px}
      @media print{button{display:none}}
    </style></head><body>
    ${bodyHtml}
    <script>window.onload=function(){window.print()}</script>
    </body></html>`);
  win.document.close();
}
