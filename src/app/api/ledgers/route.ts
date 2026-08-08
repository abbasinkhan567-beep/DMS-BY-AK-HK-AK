import { NextRequest, NextResponse } from "next/server";
import { getLedgerRows } from "@/lib/ledger-rows";

export async function GET(req: NextRequest) {
  const type = new URL(req.url).searchParams.get("type") || "company";
  const subType = new URL(req.url).searchParams.get("sub_type") || type;
  const from = new URL(req.url).searchParams.get("from");
  const to = new URL(req.url).searchParams.get("to");

  const rows = getLedgerRows(type, subType, from, to);

  const columns =
    type === "salesman"
      ? {
          debit:
            subType === "salesman-to-customer"
              ? "Salesman Amount"
              : subType === "customer-to-salesman"
                ? "Customer Amount"
                : "Commission",
          credit: subType === "customer-to-salesman" ? "Customer Amount" : "Paid",
          notes: "Details",
        }
      : type === "customer"
        ? { debit: "Bill Amount", credit: "Paid", notes: "Details" }
        : type === "floor"
          ? { debit: "Qty OUT", credit: "Qty IN", notes: "Details" }
          : undefined;

  return NextResponse.json({ type, rows, ...(columns ? { columns } : {}) });
}
