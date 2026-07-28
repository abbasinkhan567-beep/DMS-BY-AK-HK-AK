export const ledgerSubTabs = {
  company: [
    { id: "company", label: "All" },
    { id: "company-conditional", label: "Conditional" },
    { id: "company-hand", label: "Hand to Hand" },
    { id: "company-paid", label: "Paid" },
  ],
  salesman: [
    { id: "salesman", label: "All" },
    { id: "salesman-to-customer", label: "Salesman → Customer" },
    { id: "customer-to-salesman", label: "Customer → Salesman" },
  ],
} as const;
