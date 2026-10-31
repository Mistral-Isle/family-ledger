import type { Category, Txn } from "./types";
import { assertMoney } from "./money";
import { budgetTxns, categoryAmounts, totals } from "./selectors";
import { today, validDate } from "./date";
import { averageExpense } from "./reports";

export type DetailBudgetPreferences = {
  excludedCategoryIds: string[];
  title: string;
};

/** A display projection only: never modifies transactions or the full budget. */
export function detailBudget(
  txns: Txn[],
  categories: Category[],
  month: string,
  total: number | null,
  allocations: Record<string, number>,
  preferences: DetailBudgetPreferences,
) {
  txns = budgetTxns(txns);
  const excluded = new Set(preferences.excludedCategoryIds);
  const byId = new Map(categories.map((c) => [c.id, c]));
  const includes = (id: string | null): boolean => {
    if (!id) return true;
    const parent = byId.get(id)?.parentId;
    return !excluded.has(id) && (!parent || !excluded.has(parent));
  };
  const cats = categories.filter((c) => !c.deleted && c.kind === "expense");
  const included = cats.filter((c) => includes(c.id));
  const omitted = cats.filter((c) => !includes(c.id));
  const filtered = omitted.length > 0;
  const none = cats.length > 0 && included.length === 0;
  // A parent's allocation already contains its children. Subtract it only once.
  const excludedAmount = Object.entries(allocations).reduce(
    (sum, [id, amount]) => {
      const parent = byId.get(id)?.parentId;
      return excluded.has(id) && (!parent || !excluded.has(parent))
        ? assertMoney(sum + amount)
        : sum;
    },
    0,
  );
  const budget =
    total === null
      ? null
      : none
        ? 0
        : Math.max(0, assertMoney(total - excludedAmount));
  const expense = none
    ? 0
    : totals(
        txns.filter(
          (txn) => txn.occurredAt.startsWith(month) && includes(txn.categoryId),
        ),
      ).expense;
  return {
    budget,
    expense,
    remaining: budget === null ? null : assertMoney(budget - expense),
    progress:
      budget === null
        ? 0
        : budget > 0
          ? Math.min(1, Math.max(0, expense) / budget)
          : expense > 0
            ? 1
            : 0,
    title: preferences.title.trim() || (filtered ? "所选分类预算" : "本月预算"),
    filtered,
    included,
    omitted,
    explanation: filtered
      ? "按已开启的分类计算预算与支出。可在预算设置中调整范围，不影响账单和完整预算。"
      : "当前包含全部支出分类。可在预算设置中调整明细页的显示范围。",
  };
}

export function monthDailyMetrics(
  month: string,
  expense: number,
  budget: number | null,
  now = today(),
) {
  validDate(month + "-01");
  validDate(now);
  const days = new Date(
    Date.UTC(Number(month.slice(0, 4)), Number(month.slice(5)), 0),
  ).getUTCDate();
  const current = now.slice(0, 7);
  const elapsed =
    month === current ? Number(now.slice(8)) : month < current ? days : 0;
  const remaining =
    month === current
      ? days - Number(now.slice(8)) + 1
      : month > current
        ? days
        : 0;
  return {
    elapsed,
    remaining,
    dailyExpense: elapsed ? averageExpense(expense, elapsed) : null,
    dailyRemaining:
      budget !== null && remaining
        ? averageExpense(assertMoney(budget - expense), remaining)
        : null,
  };
}

/** Parent allocations include their children; refunds offset the original category. */
export function categoryBudgetUsage(
  txns: Txn[],
  categories: Category[],
  month: string,
): Map<string, number> {
  const amounts = categoryAmounts(
    budgetTxns(txns).filter((txn) => txn.occurredAt.startsWith(month)),
    "expense",
  );
  const usage = new Map(amounts);
  for (const [id, amount] of amounts) {
    const parent = categories.find((c) => c.id === id)?.parentId;
    if (parent)
      usage.set(parent, assertMoney((usage.get(parent) ?? 0) + amount));
  }
  return usage;
}

export function validateBudgetAllocation(
  total: number | null,
  allocations: Record<string, number>,
  categories: Category[],
) {
  if (total !== null && assertMoney(total) < 0)
    throw new Error("总预算不能小于零");
  let roots = 0;
  for (const [id, amount] of Object.entries(allocations)) {
    if (assertMoney(amount) < 0) throw new Error("分类预算不能小于零");
    const category = categories.find(
      (c) => c.id === id && !c.deleted && c.kind === "expense",
    );
    if (!category) throw new Error("请选择有效的支出分类");
    if (!category.parentId) roots = assertMoney(roots + amount);
    else if (!(category.parentId in allocations))
      throw new Error("请先设置该分类的一级预算");
  }
  if (Object.keys(allocations).length && total === null)
    throw new Error("请先填写总预算");
  if (roots > (total ?? 0)) throw new Error("一级分类预算之和不能超过总预算");
  for (const root of categories.filter((c) => !c.parentId && !c.deleted)) {
    const children = categories
      .filter((c) => c.parentId === root.id && !c.deleted)
      .reduce((sum, c) => assertMoney(sum + (allocations[c.id] ?? 0)), 0);
    if (children > (allocations[root.id] ?? 0))
      throw new Error(`${root.name}的二级预算之和不能超过一级预算`);
  }
  return allocations;
}
