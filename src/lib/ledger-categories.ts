export const ledgerSubTabs = {
  company: [
    { id: "company", label: "All" },
    { id: "company-conditional", label: "Conditional" },
    { id: "company-hand", label: "Hand to Hand" },
    { id: "company-paid", label: "Paid" },
  ],
  salesman: [
    { id: "salesman", label: "All" },
    { id: "salesman-commission", label: "Commission" },
    { id: "salesman-to-customer", label: "Salesman → Customer" },
    { id: "customer-to-salesman", label: "Customer → Salesman" },
  ],
} as const;

export function getLedgerSubTypeFilter(type: string, subType: string) {
  if (type === "company") {
    if (subType === "company") {
      return { clause: "(sub_type IS NULL OR sub_type = '' OR sub_type = ?)", param: type };
    }
    if (subType.startsWith("company-")) {
      return { clause: "(sub_type = ?)", param: subType };
    }
  }

  if (type === "salesman") {
    if (subType === "salesman") {
      return { clause: "(sub_type IS NULL OR sub_type = '' OR sub_type = ?)", param: type };
    }
    if (subType === "salesman-to-customer" || subType === "customer-to-salesman") {
      return { clause: "(sub_type = ?)", param: subType };
    }
  }

  return { clause: "(sub_type IS NULL OR sub_type = '' OR sub_type = ?)", param: type };
}
