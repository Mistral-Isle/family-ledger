export type SummaryPreferences = {
  page: "cashflow" | "budget";
  cashflowMetric: "expense" | "income" | "balance";
  budgetMetric: "remaining" | "used" | "total";
  /** Shared by the budget page and the detail card so both show the same numbers. */
  budgetScope: "all" | "selected";
};

/** Local display choices only; older backups may not contain this preference. */
export function summaryPreferences(value: unknown): SummaryPreferences {
  const saved = (
    value && typeof value === "object" ? value : {}
  ) as Partial<SummaryPreferences>;
  return {
    page: saved.page === "budget" ? "budget" : "cashflow",
    cashflowMetric:
      saved.cashflowMetric === "income" || saved.cashflowMetric === "balance"
        ? saved.cashflowMetric
        : "expense",
    budgetMetric:
      saved.budgetMetric === "total" || saved.budgetMetric === "used"
        ? saved.budgetMetric
        : "remaining",
    budgetScope: saved.budgetScope === "all" ? "all" : "selected",
  };
}
