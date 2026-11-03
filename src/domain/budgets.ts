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
  const excludedAmount = cats.reduce((sum, c) => {
    if (!excluded.has(c.id) || (c.parentId && excluded.has(c.parentId)))
      return sum;
    return assertMoney(
      sum + (effectiveAllocation(c.id, allocations, categories) ?? 0),
    );
  }, 0);
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
    title: preferences.title.trim() || (filtered ? "日常预算" : "本月预算"),
    filtered,
    included,
    omitted,
    explanation: filtered
      ? "按已开启的分类计算预算与支出。可在预算设置中调整范围，不影响账单和完整预算。"
      : "当前包含全部支出分类。可在预算设置中调整明细页的显示范围。",
  };
}

export type BudgetScope = "all" | "selected";

/** "all" ignores the category switches; "selected" is the detail budget. */
export function scopedBudget(
  scope: BudgetScope,
  txns: Txn[],
  categories: Category[],
  month: string,
  total: number | null,
  allocations: Record<string, number>,
  preferences: DetailBudgetPreferences,
) {
  if (scope === "selected")
    return detailBudget(txns, categories, month, total, allocations, preferences);
  return {
    ...detailBudget(txns, categories, month, total, allocations, {
      ...preferences,
      excludedCategoryIds: [],
    }),
    title: "全部预算",
    explanation: "包含全部支出分类，已关闭的分类（如房租、车贷）也计入。",
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
  for (const [id, amount] of Object.entries(allocations)) {
    if (assertMoney(amount) < 0) throw new Error("分类预算不能小于零");
    const category = categories.find(
      (c) => c.id === id && !c.deleted && c.kind === "expense",
    );
    if (!category) throw new Error("请选择有效的支出分类");
  }
  if (Object.keys(allocations).length && total === null)
    throw new Error("请先填写总预算");
  return allocations;
}

/** Over-allocation is allowed while typing; the editor only points it out. */
export function budgetAllocationWarnings(
  total: number | null,
  allocations: Record<string, number>,
  categories: Category[],
) {
  const live = categories.filter((c) => !c.deleted && c.kind === "expense");
  const rootSum = live
    .filter((c) => !c.parentId)
    .reduce((sum, c) => assertMoney(sum + (allocations[c.id] ?? 0)), 0);
  const children: Record<string, { sum: number; over: number }> = {};
  for (const root of live.filter((c) => !c.parentId)) {
    const sum = live
      .filter((c) => c.parentId === root.id)
      .reduce((n, c) => assertMoney(n + (allocations[c.id] ?? 0)), 0);
    const limit = allocations[root.id];
    // Without its own amount a parent simply shows what its children add up to.
    if (limit !== undefined && sum > limit)
      children[root.id] = { sum, over: assertMoney(sum - limit) };
  }
  return {
    rootSum,
    rootOver:
      total !== null && rootSum > total ? assertMoney(rootSum - total) : 0,
    children,
  };
}

/** A parent without its own amount is budgeted by what its children add up to. */
export function effectiveAllocation(
  id: string,
  allocations: Record<string, number>,
  categories: Category[],
): number | undefined {
  if (id in allocations) return allocations[id];
  const children = categories.filter(
    (c) => c.parentId === id && !c.deleted && c.id in allocations,
  );
  return children.length
    ? children.reduce((sum, c) => assertMoney(sum + allocations[c.id]!), 0)
    : undefined;
}
