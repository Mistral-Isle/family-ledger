import type { Category } from "./types";
import { assertMoney } from "./money";

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
