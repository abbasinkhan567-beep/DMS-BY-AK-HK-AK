export type LedgerAutoEntry = {
  ledger_type: "company" | "customer" | "expense";
  entry_date: string;
  ref: string | null;
  party: string | null;
  debit: number;
  credit: number;
  source: string;
  notes: string;
  sub_type?: string | null;
};

export function buildPurchaseLedgerAutoEntries(input: {
  purchaseId: number;
  invoiceNo?: string | null;
  entryDate: string;
  party: string;
  totalAmount: number;
  paidAmount: number;
  expenseAmount?: number;
}) {
  const entries: LedgerAutoEntry[] = [];
  const ref = input.invoiceNo || `#${input.purchaseId}`;
  const baseNotes = `Auto posting purchase ${ref}`;

  entries.push({
    ledger_type: "company",
    entry_date: input.entryDate,
    ref,
    party: input.party || "Supplier",
    debit: Number(input.totalAmount) || 0,
    credit: Number(input.paidAmount) || 0,
    source: "Purchase",
    notes: `${baseNotes} | total ${input.totalAmount}`,
    sub_type: "company",
  });

  if ((Number(input.expenseAmount) || 0) > 0) {
    entries.push({
      ledger_type: "company",
      entry_date: input.entryDate,
      ref,
      party: input.party || "Supplier",
      debit: Number(input.expenseAmount) || 0,
      credit: 0,
      source: "Purchase Expense",
      notes: `${baseNotes} | expense ${input.expenseAmount}`,
      sub_type: "company",
    });
  }

  return entries;
}

export function buildSaleLedgerAutoEntries(input: {
  saleId: number;
  invoiceNo?: string | null;
  entryDate: string;
  party: string;
  totalAmount: number;
  paidAmount: number;
}) {
  const ref = input.invoiceNo || `#${input.saleId}`;
  return [
    {
      ledger_type: "customer" as const,
      entry_date: input.entryDate,
      ref,
      party: input.party || "Customer",
      debit: Number(input.totalAmount) || 0,
      credit: Number(input.paidAmount) || 0,
      source: "Sale",
      notes: `Auto posting sale ${ref}`,
      sub_type: "customer",
    },
  ];
}

export function buildExpenseLedgerAutoEntries(input: {
  expenseId: number;
  invoiceNo?: string | null;
  entryDate: string;
  party: string;
  amount: number;
  paidFrom?: string | null;
}) {
  const ref = input.invoiceNo || `EXP-${input.expenseId}`;
  return [
    {
      ledger_type: "expense" as const,
      entry_date: input.entryDate,
      ref,
      party: input.party || "Expense",
      debit: Number(input.amount) || 0,
      credit: 0,
      source: input.paidFrom || "Cash",
      notes: `Auto posting expense ${ref}`,
      sub_type: "expense",
    },
  ];
}
