import { formatDate, formatMoney, printHtml, downloadCsv, escapeHtml } from "@/lib/utils";

type PurchaseBill = {
  id: number;
  invoice_no: string | null;
  supplier: string;
  company_name?: string | null;
  purchase_date: string;
  total_amount: number;
  paid_amount: number;
  notes?: string | null;
  items: Array<{
    product_id?: number;
    product_name?: string | null;
    company_name?: string | null;
    size?: string | null;
    quantity: number;
    hand_to_hand?: number;
    conditional?: number;
    rate_per_cotton?: number;
    total_rate?: number;
    total?: number;
  }>;
};

type SaleBill = {
  id: number;
  invoice_no: string | null;
  sale_date: string;
  customer_name: string;
  shop_name?: string | null;
  salesman_name?: string | null;
  total_amount: number;
  paid_amount: number;
  bill_bakaya?: number;
  empty_qty?: number;
  bank_account?: string | null;
  expense1_label?: string | null;
  expense1_amount?: number;
  expense2_label?: string | null;
  expense2_amount?: number;
  expense3_label?: string | null;
  expense3_amount?: number;
  total_commission?: number;
  total_discount?: number;
  total_bill_expense?: number;
  items: Array<{
    product_id?: number;
    product_name?: string | null;
    size?: string | null;
    quantity: number;
    unit_price: number;
    commission?: number;
    discount?: number;
    total?: number;
  }>;
};

type Company = {
  name?: string;
  phone?: string;
  address?: string;
};

export async function fetchCompany(): Promise<Company> {
  try {
    const res = await fetch("/api/settings");
    const data = await res.json();
    return data.company || {};
  } catch {
    return {};
  }
}

export async function printPurchaseBill(id: number) {
  const [billRes, company, returnsRes] = await Promise.all([
    fetch(`/api/purchases?id=${id}`).then((r) => r.json()),
    fetchCompany(),
    fetch(`/api/purchase-returns?purchase_id=${id}`).then((r) => r.json()),
  ]);
  const bill = billRes as PurchaseBill;
  const returns = (returnsRes || []) as Array<{
    product_id?: number;
    product_name?: string;
    product_size?: string | null;
    qty: number;
    rate: number;
  }>;

  const retByProduct = new Map<number, number>();
  for (const r of returns) {
    if (r.product_id) retByProduct.set(r.product_id, (retByProduct.get(r.product_id) || 0) + r.qty);
  }
  const returnTotal = returns.reduce((s, r) => s + r.qty * (r.rate || 0), 0);

  const rows = (bill.items || [])
    .map((i) => {
      const retQty = retByProduct.get(i.product_id ?? Number.NaN) || 0;
      const netQty = Math.max(0, Number(i.quantity) - retQty);
      const outTotal = Number(i.total_rate || i.total || 0);
      const retAmt = retQty * (Number(i.rate_per_cotton) || 0);
      const netTotal = Math.max(0, outTotal - retAmt);
      return `<tr>
      <td>${escapeHtml(i.product_name || "-")}</td>
      <td>${escapeHtml(i.company_name || bill.company_name || bill.supplier)}</td>
      <td>${escapeHtml(i.size || "-")}</td>
      <td>${i.quantity}</td>
      <td>${retQty || "-"}</td>
      <td>${netQty}</td>
      <td>${i.hand_to_hand || 0}</td>
      <td>${i.conditional || 0}</td>
      <td>${formatMoney(i.rate_per_cotton || 0)}</td>
      <td>${formatMoney(netTotal)}</td>
    </tr>`;
    })
    .join("");

  printHtml(
    `Purchase ${bill.invoice_no || bill.id}`,
    `<h1>${escapeHtml(company.name || "Pepsi Distribution")}</h1>
     <h2>${escapeHtml(company.phone || "")} ${company.address ? "· " + escapeHtml(company.address) : ""}</h2>
     <div class="meta">
       <div><strong>Purchase Bill</strong><br/>Invoice: ${escapeHtml(bill.invoice_no || "#" + bill.id)}</div>
       <div>Date: ${formatDate(bill.purchase_date)}<br/>Supplier: ${escapeHtml(bill.supplier)}<br/>Company: ${escapeHtml(bill.company_name || "-")}</div>
     </div>
     <table>
       <thead><tr>
         <th>Product</th><th>Company</th><th>Size</th><th>Qty</th><th>Return</th><th>Net Qty</th><th>Hand to Hand</th><th>Conditional</th><th>Rate/Carton</th><th>Amount</th>
       </tr></thead>
       <tbody>${rows}</tbody>
     </table>
     <div class="totals">
       <div><span>Return Amount</span><span>- ${formatMoney(returnTotal)}</span></div>
       <div><span>Total</span><span>${formatMoney(bill.total_amount)}</span></div>
       <div><span>Paid</span><span>${formatMoney(bill.paid_amount)}</span></div>
       <div class="grand"><span>Net Bill Total</span><span>${formatMoney(Math.max(0, bill.total_amount - returnTotal))}</span></div>
       <div class="grand"><span>Balance</span><span>${formatMoney(Math.max(0, bill.total_amount - returnTotal - bill.paid_amount))}</span></div>
     </div>`
  );
}

export async function excelPurchaseBill(id: number) {
  const bill = (await fetch(`/api/purchases?id=${id}`).then((r) => r.json())) as PurchaseBill;
  downloadCsv(`purchase-${bill.invoice_no || bill.id}.csv`, (bill.items || []).map((i) => ({
    Product: i.product_name,
    Company: i.company_name || bill.company_name,
    Size: i.size,
    Quantity: i.quantity,
    "Hand to Hand": i.hand_to_hand || 0,
    Conditional: i.conditional || 0,
    "Rate Per Carton": i.rate_per_cotton || 0,
    "Total Rate": i.total_rate || i.total || 0,
  })));
}

export async function printSaleBill(id: number) {
  const [billRes, company, returnsRes] = await Promise.all([
    fetch(`/api/sales?id=${id}`).then((r) => r.json()),
    fetchCompany(),
    fetch(`/api/sales-returns?sale_id=${id}`).then((r) => r.json()),
  ]);
  const bill = billRes as SaleBill;
  const returns = (returnsRes || []) as Array<{
    product_id?: number;
    product_name?: string;
    product_size?: string | null;
    qty: number;
    rate: number;
  }>;

  const retByProduct = new Map<number, number>();
  for (const r of returns) {
    if (r.product_id) retByProduct.set(r.product_id, (retByProduct.get(r.product_id) || 0) + r.qty);
  }
  const returnTotal = returns.reduce((s, r) => s + r.qty * (r.rate || 0), 0);

  const rows = (bill.items || [])
    .map((i) => {
      const retQty = retByProduct.get(i.product_id ?? (i as { id?: number }).id ?? Number.NaN) || 0;
      const netQty = Math.max(0, Number(i.quantity) - retQty);
      const outTotal = Number(i.total || i.quantity * i.unit_price - (i.discount || 0));
      const retAmt = retQty * (i.unit_price || 0);
      const netTotal = Math.max(0, outTotal - retAmt);
      return `<tr>
      <td>${escapeHtml(i.product_name || "-")}</td>
      <td>${escapeHtml(i.size || (i as { linked_size?: string }).linked_size || "-")}</td>
      <td>${i.quantity}</td>
      <td>${retQty || "-"}</td>
      <td>${netQty}</td>
      <td>${formatMoney(i.unit_price)}</td>
      <td>${formatMoney(netTotal)}</td>
    </tr>`;
    })
    .join("");

  printHtml(
    `Sale ${bill.invoice_no || bill.id}`,
    `<h1>${escapeHtml(company.name || "Pepsi Distribution")}</h1>
     <h2>${escapeHtml(company.phone || "")} ${company.address ? "· " + escapeHtml(company.address) : ""}</h2>
     <div class="meta">
       <div><strong>Sale Bill</strong><br/>Invoice: ${escapeHtml(bill.invoice_no || "#" + bill.id)}<br/>Salesman: ${escapeHtml(bill.salesman_name || "-")}</div>
       <div>Date: ${formatDate(bill.sale_date)}<br/>Customer: ${escapeHtml(bill.shop_name || bill.customer_name)}<br/>Bank: ${escapeHtml(bill.bank_account || "-")}</div>
     </div>
     <table>
       <thead><tr>
         <th>Product</th><th>Size</th><th>Qty</th><th>Return</th><th>Net Qty</th><th>Rate</th><th>Amount</th>
       </tr></thead>
       <tbody>${rows}</tbody>
     </table>
     <div class="totals">
       <div><span>Return Amount</span><span>- ${formatMoney(returnTotal)}</span></div>
       <div><span>Total Commission</span><span>${formatMoney(bill.total_commission || 0)}</span></div>
       <div><span>Total Discount</span><span>${formatMoney(bill.total_discount || 0)}</span></div>
       <div><span>${escapeHtml(bill.expense1_label || "Expense 1")}</span><span>${formatMoney(bill.expense1_amount || 0)}</span></div>
       <div><span>${escapeHtml(bill.expense2_label || "Expense 2")}</span><span>${formatMoney(bill.expense2_amount || 0)}</span></div>
       <div><span>${escapeHtml(bill.expense3_label || "Expense 3")}</span><span>${formatMoney(bill.expense3_amount || 0)}</span></div>
       <div><span>Bill Expense Total</span><span>${formatMoney(bill.total_bill_expense || 0)}</span></div>
       <div><span>Empty</span><span>${bill.empty_qty || 0}</span></div>
       <div><span>Paid</span><span>${formatMoney(bill.paid_amount)}</span></div>
       <div><span>Bill Balance Due</span><span>${formatMoney(bill.bill_bakaya || 0)}</span></div>
       <div class="grand"><span>Bill Total</span><span>${formatMoney(Math.max(0, bill.total_amount - returnTotal))}</span></div>
     </div>`
  );
}

export async function excelSaleBill(id: number) {
  const bill = (await fetch(`/api/sales?id=${id}`).then((r) => r.json())) as SaleBill;
  downloadCsv(`sale-${bill.invoice_no || bill.id}.csv`, [
    ...(bill.items || []).map((i) => ({
      Type: "Item",
      Product: i.product_name,
      Size: i.size || (i as { linked_size?: string }).linked_size || "",
      Quantity: i.quantity,
      Rate: i.unit_price,
      Commission: i.commission || 0,
      Discount: i.discount || 0,
      Total: i.total || 0,
    })),
    {
      Type: "Summary",
      Product: "TOTALS",
      Quantity: "",
      Rate: "",
      Commission: bill.total_commission || 0,
      Discount: bill.total_discount || 0,
      Total: bill.total_amount,
    },
  ]);
}

type StockbookPrintProduct = {
  name: string;
  size?: string | null;
  opening: number;
  floor: number;
  company: number;
  closing: number;
};

type StockbookPrintSalesman = {
  name: string;
  qty: Record<string, number>;
};

export function printStockbookBill(opts: {
  companyName?: string;
  companyPhone?: string;
  companyAddress?: string;
  date: string;
  note?: string;
  products: StockbookPrintProduct[];
  salesmen: StockbookPrintSalesman[];
}) {
  const headers = ["Particulars", ...opts.products.map((p) => `${escapeHtml(p.name)}${p.size ? " (" + escapeHtml(p.size) + ")" : ""}`), "Total"];
  const qtyCell = (pid: string, qty: number) =>
    `<td style="text-align:center">${qty || 0}</td>`;
  const rowTotal = (vals: number[]) =>
    `<td style="text-align:center;font-weight:600">${vals.reduce((s, v) => s + (v || 0), 0)}</td>`;

  const headRow = `<tr>${headers.map((h) => `<th>${h}</th>`).join("")}</tr>`;

  const row = (label: string, vals: number[], bold = false) =>
    `<tr><td><strong>${label}</strong></td>${opts.products
      .map((_, i) => qtyCell(String(i), vals[i] || 0))
      .join("")}${rowTotal(vals)}</tr>`;

  const opening = opts.products.map((p) => p.opening);
  const floor = opts.products.map((p) => p.floor);
  const company = opts.products.map((p) => p.company);
  const closing = opts.products.map((p) => p.closing);
  const totalSale = opts.products.map((_, i) =>
    opts.salesmen.reduce((s, sm) => s + (sm.qty[String(i)] || 0), 0)
  );

  const salesmanRows = opts.salesmen
    .map(
      (sm) =>
        `<tr><td>${escapeHtml(sm.name)}</td>${opts.products
          .map((_, i) => qtyCell(String(i), sm.qty[String(i)] || 0))
          .join("")}${rowTotal(opts.products.map((_, i) => sm.qty[String(i)] || 0))}</tr>`
    )
    .join("");

  const boldRow = (label: string, vals: number[]) =>
    `<tr style="background:#f8fafc"><td><strong>${label}</strong></td>${opts.products
      .map((_, i) => `<td style="text-align:center;font-weight:700">${vals[i] || 0}</td>`)
      .join("")}${rowTotal(vals)}</tr>`;

  printHtml(
    `Stock Sheet ${opts.date}`,
    `<h1>${escapeHtml(opts.companyName || "Pepsi Distribution")}</h1>
     <h2>${escapeHtml(opts.companyPhone || "")} ${opts.companyAddress ? "· " + escapeHtml(opts.companyAddress) : ""}</h2>
     <div class="meta">
       <div><strong>Daily Stock Sheet</strong><br/>Date: ${formatDate(opts.date)}</div>
       <div>${opts.note ? "Note: " + escapeHtml(opts.note) : ""}</div>
     </div>
     <table>
       <thead>${headRow}</thead>
       <tbody>
         ${row("Opening Stock", opening)}
         ${salesmanRows}
         ${boldRow("Total Sale", totalSale)}
         ${row("Floor Stock", floor)}
         ${row("Stock From Company", company)}
         ${boldRow("Closing Stock", closing)}
       </tbody>
     </table>`
  );
}
