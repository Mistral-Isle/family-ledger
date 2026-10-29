import type { Account, Snapshot, Txn, Scope } from "./types";
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
export function visibleTxns(txns: Txn[], scope: Scope = "family"): Txn[] {
  return txns
    .filter((t) => !t.deleted && !t.discarded && t.scope === scope)
    .sort(
      (a, b) =>
        b.occurredAt.localeCompare(a.occurredAt) ||
        b.createdAt.localeCompare(a.createdAt),
    );
}
export function totals(txns: Txn[]): {
  expense: number;
  income: number;
  balance: number;
} {
  let expense = 0;
  let income = 0;
  for (const t of txns) {
    if (t.deleted || t.discarded || t.scope !== "family") continue;
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
    if (t.deleted || t.discarded || t.scope !== "family") continue;
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
