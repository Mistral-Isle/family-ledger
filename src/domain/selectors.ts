import type { Account, Category, Snapshot, Txn, Scope } from "./types";
import { assertMoney } from "./money";
export function accountBalance(
  account: Account,
  txns: Txn[],
  at = "9999-12-31",
): number {
  return txns
    .filter(
      (t) => !t.deleted && t.scope === account.scope && t.occurredAt <= at,
    )
    .reduce((sum, t) => {
      let delta = 0;
      if (t.accountId === account.id)
        delta +=
          t.type === "income" ||
          t.type === "refund" ||
          t.type === "adjust" ||
          t.type === "scope_in"
            ? t.amount
            : -t.amount;
      if (
        t.toAccountId === account.id &&
        (t.type === "transfer" || t.type === "repayment")
      )
        delta += t.amount;
      return assertMoney(sum + delta);
    }, account.initialBalance);
}
/** New entries start on the first visible category: its first child, or the root itself. */
export function firstCategory(
  categories: Category[],
  kind: Category["kind"],
): Category | undefined {
  const visible = categories
    .filter((c) => !c.deleted && !c.hidden && c.kind === kind)
    .sort((a, b) => a.sort - b.sort);
  const root = visible.find((c) => !c.parentId);
  return visible.find((c) => c.parentId === root?.id) ?? root;
}
/** Derived from the current refunds, so edits and deletions update it everywhere. */
export function refundState(txns: Txn[], expense: Txn) {
  if (expense.type !== "expense") return null;
  const refunds = txns.filter(
    (t) =>
      !t.deleted &&
      !t.discarded &&
      t.type === "refund" &&
      t.refundOfId === expense.id,
  );
  if (!refunds.length) return null;
  const income = refunds.reduce(
    (sum, t) => assertMoney(sum + (t.refundIncome ?? 0)),
    0,
  );
  const offset = refunds.reduce(
    (sum, t) => assertMoney(sum + t.amount - (t.refundIncome ?? 0)),
    0,
  );
  return {
    kind:
      income > 0
        ? ("over" as const)
        : offset >= expense.amount
          ? ("full" as const)
          : ("partial" as const),
    net: Math.max(0, expense.amount - offset),
    income,
  };
}
export function visibleTxns(txns: Txn[], scope: Scope = "family"): Txn[] {
  return txns
    .filter((t) => !t.deleted && !t.discarded && t.scope === scope)
    .sort(
      (a, b) =>
        b.occurredAt.localeCompare(a.occurredAt) ||
        b.createdAt.localeCompare(a.createdAt),
    );
}
export function budgetTxns(txns: Txn[]): Txn[] {
  return txns
    .filter((t) => !t.excludeBudget)
    .map((t) => ({ ...t, excludeTotals: false }));
}
export function totals(txns: Txn[]): {
  expense: number;
  income: number;
  balance: number;
} {
  let expense = 0;
  let income = 0;
  for (const t of txns) {
    if (t.deleted || t.discarded || t.excludeTotals || t.scope !== "family")
      continue;
    if (t.type === "expense") expense = assertMoney(expense + t.amount);
    if (t.type === "refund") {
      expense = assertMoney(expense - (t.amount - (t.refundIncome ?? 0)));
      income = assertMoney(income + (t.refundIncome ?? 0));
    }
    if (t.type === "income") income = assertMoney(income + t.amount);
  }
  return { expense, income, balance: assertMoney(income - expense) };
}
export function categoryAmounts(
  txns: Txn[],
  kind: "expense" | "income",
): Map<string, number> {
  const amounts = new Map<string, number>();
  for (const t of txns) {
    if (t.deleted || t.discarded || t.excludeTotals || t.scope !== "family")
      continue;
    const categoryId =
      t.type === "refund" && kind === "income"
        ? t.refundIncomeCategoryId
        : t.categoryId;
    const amount =
      t.type === kind
        ? t.amount
        : t.type === "refund"
          ? kind === "income"
            ? (t.refundIncome ?? 0)
            : -(t.amount - (t.refundIncome ?? 0))
          : 0;
    if (categoryId && amount)
      amounts.set(
        categoryId,
        assertMoney((amounts.get(categoryId) ?? 0) + amount),
      );
  }
  return amounts;
}
export function categoryLabel(snapshot: Snapshot, t: Txn): string {
  return snapshot.categories.find((c) => c.id === t.categoryId)?.name ?? t.type;
}
