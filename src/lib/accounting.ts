type AutoEntry = {
  accountName: string;
  entryType: "debit" | "credit";
  amount: number;
  narration: string;
  refNo?: string;
};

function money(value: number) {
  return Number(value || 0);
}

export function buildSaleAutoEntries(input: {
  customerName: string;
  totalAmount: number;
  paidAmount: number;
  paymentType?: string;
  bankAccountName?: string;
  invoiceNo?: string;
}) {
  const entries: AutoEntry[] = [];
  const total = money(input.totalAmount);
  const paid = money(input.paidAmount);
  const balance = Math.max(0, total - paid);

  entries.push({
    accountName: "Cash Counter",
    entryType: "debit",
    amount: paid,
    narration: `Sale receipt ${input.invoiceNo || ""}`.trim(),
    refNo: input.invoiceNo,
  });

  if (balance > 0) {
    entries.push({
      accountName: input.customerName || "Customer",
      entryType: "debit",
      amount: balance,
      narration: `Customer balance ${input.invoiceNo || ""}`.trim(),
      refNo: input.invoiceNo,
    });
  }

  entries.push({
    accountName: "Sales Revenue",
    entryType: "credit",
    amount: total,
    narration: `Sales posting ${input.invoiceNo || ""}`.trim(),
    refNo: input.invoiceNo,
  });

  if (input.paymentType && input.paymentType.toLowerCase() === "bank" && input.bankAccountName) {
    entries[0] = {
      ...entries[0],
      accountName: input.bankAccountName,
    };
  }

  return entries;
}

export function buildPurchaseAutoEntries(input: {
  supplierName: string;
  totalAmount: number;
  paidAmount: number;
  expenseAmount?: number;
  paymentType?: string;
  bankAccountName?: string;
  invoiceNo?: string;
}) {
  const entries: AutoEntry[] = [];
  const total = money(input.totalAmount);
  const paid = money(input.paidAmount);
  const expense = money(input.expenseAmount ?? 0);

  entries.push({
    accountName: "Purchases",
    entryType: "debit",
    amount: total,
    narration: `Purchase posting ${input.invoiceNo || ""}`.trim(),
    refNo: input.invoiceNo,
  });

  if (paid > 0) {
    entries.push({
      accountName: "Cash Counter",
      entryType: "credit",
      amount: paid,
      narration: `Purchase payment ${input.invoiceNo || ""}`.trim(),
      refNo: input.invoiceNo,
    });
  }

  entries.push({
    accountName: input.supplierName || "Supplier",
    entryType: "credit",
    amount: Math.max(0, total - paid),
    narration: `Supplier balance ${input.invoiceNo || ""}`.trim(),
    refNo: input.invoiceNo,
  });

  if (expense > 0) {
    entries.push({
      accountName: "General Expense",
      entryType: "debit",
      amount: expense,
      narration: `Purchase expense ${input.invoiceNo || ""}`.trim(),
      refNo: input.invoiceNo,
    });
  }

  if (input.paymentType && input.paymentType.toLowerCase() === "bank" && input.bankAccountName) {
    entries[1] = {
      ...entries[1],
      accountName: input.bankAccountName,
    };
  }

  return entries;
}

export function buildExpenseAutoEntries(input: {
  title: string;
  amount: number;
  paidFrom?: string;
  invoiceNo?: string;
}) {
  const amount = money(input.amount);
  const paidFrom = (input.paidFrom || "cash").toLowerCase();
  const entries: AutoEntry[] = [];

  entries.push({
    accountName: input.title || "Expense",
    entryType: "debit",
    amount,
    narration: `Expense ${input.invoiceNo || ""}`.trim(),
    refNo: input.invoiceNo,
  });

  if (paidFrom === "bank") {
    entries.push({
      accountName: "Main Bank",
      entryType: "credit",
      amount,
      narration: `Expense payment ${input.invoiceNo || ""}`.trim(),
      refNo: input.invoiceNo,
    });
  } else {
    entries.push({
      accountName: "Cash Counter",
      entryType: "credit",
      amount,
      narration: `Expense payment ${input.invoiceNo || ""}`.trim(),
      refNo: input.invoiceNo,
    });
  }

  return entries;
}
