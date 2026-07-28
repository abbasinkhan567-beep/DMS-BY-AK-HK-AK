import test from "node:test";
import assert from "node:assert/strict";
import { buildExpenseAutoEntries, buildPurchaseAutoEntries, buildSaleAutoEntries } from "./accounting";

test("buildSaleAutoEntries creates balanced sale entries", () => {
  const entries = buildSaleAutoEntries({
    customerName: "ABC Traders",
    totalAmount: 1200,
    paidAmount: 500,
    paymentType: "cash",
    bankAccountName: "Main Bank",
    invoiceNo: "INV-1001",
  });

  assert.equal(entries.length, 3);
  assert.equal(entries[0].accountName, "Cash Counter");
  assert.equal(entries[0].entryType, "debit");
  assert.equal(entries[1].accountName, "ABC Traders");
  assert.equal(entries[2].accountName, "Sales Revenue");
  assert.equal(entries[2].entryType, "credit");
});

test("buildPurchaseAutoEntries creates supplier and expense entries", () => {
  const entries = buildPurchaseAutoEntries({
    supplierName: "Pepsi Company",
    totalAmount: 2000,
    paidAmount: 800,
    expenseAmount: 150,
    paymentType: "cash",
    bankAccountName: "Main Bank",
    invoiceNo: "PO-2001",
  });

  assert.equal(entries.length, 4);
  assert.equal(entries[0].accountName, "Purchases");
  assert.equal(entries[1].accountName, "Cash Counter");
  assert.equal(entries[2].accountName, "Pepsi Company");
  assert.equal(entries[3].accountName, "General Expense");
});

test("buildExpenseAutoEntries creates a simple expense posting", () => {
  const entries = buildExpenseAutoEntries({
    title: "Fuel",
    amount: 300,
    paidFrom: "cash",
    invoiceNo: "EXP-1",
  });

  assert.equal(entries.length, 2);
  assert.equal(entries[0].accountName, "Fuel");
  assert.equal(entries[0].entryType, "debit");
  assert.equal(entries[1].accountName, "Cash Counter");
  assert.equal(entries[1].entryType, "credit");
});
