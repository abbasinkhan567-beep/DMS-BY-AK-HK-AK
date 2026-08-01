import test from "node:test";
import assert from "node:assert/strict";
import { getLedgerSubTypeFilter } from "./ledger-categories";

test("company subtypes use the correct manual ledger filter", () => {
  assert.deepEqual(getLedgerSubTypeFilter("company", "company"), {
    clause: "(sub_type IS NULL OR sub_type = '' OR sub_type = ?)",
    param: "company",
  });
  assert.deepEqual(getLedgerSubTypeFilter("company", "company-conditional"), {
    clause: "(sub_type = ?)",
    param: "company-conditional",
  });
});

test("salesman subtypes use the correct manual ledger filter", () => {
  assert.deepEqual(getLedgerSubTypeFilter("salesman", "salesman"), {
    clause: "(sub_type IS NULL OR sub_type = '' OR sub_type = ?)",
    param: "salesman",
  });
  assert.deepEqual(getLedgerSubTypeFilter("salesman", "salesman-to-customer"), {
    clause: "(sub_type = ?)",
    param: "salesman-to-customer",
  });
});
