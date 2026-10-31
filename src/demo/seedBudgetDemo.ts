import type { LedgerRepository } from "../db/repository";
import { validDate } from "../domain/date";

/** Called only after opening the dedicated demo database. Never replaces existing records. */
export function seedBudgetDemo(repo: LedgerRepository, month: string) {
  validDate(month + "-01");
  const initial = repo.snapshot();
  if (initial.txns.length || initial.budgets.length || initial.plans.length)
    return;
  // Demonstrate the app's actual agreed defaults; never add a second taxonomy.
  const category = (name: string, parentId: string | null = null) => {
    const found = initial.categories.find(
      (c) =>
        !c.deleted &&
        c.kind === "expense" &&
        c.name === name &&
        c.parentId === parentId,
    );
    if (!found) throw new Error(`示例账本缺少分类：${name}`);
    return found.id;
  };
  const housing = category("居住");
  const dining = category("餐饮");
  const goods = category("购物");
  const travel = category("交通");
  const digital = category("数字服务");
  const rent = category("房租", housing);
  const utilities = category("水电燃气", housing);
  const subscriptions = category("话费", digital);
  const meals = category("日常用餐", dining);
  const shopping = category("日用", goods);
  const transport = category("公交地铁", travel);
  const accountId = initial.accounts.find(
    (a) => a.scope === "family" && !a.deleted,
  )!.id;
  const add = (categoryId: string, amount: number, day: string, note: string) =>
    repo.saveTxn({
      type: "expense",
      categoryId,
      amount,
      occurredAt: `${month}-${day}`,
      accountId,
      forWhom: "both",
      note: `示例 · ${note}`,
    });
  add(rent, 450000, "01", "房租");
  add(utilities, 30000, "05", "水电燃气");
  add(subscriptions, 20000, "06", "手机话费");
  add(meals, 120000, "10", "日常餐饮");
  add(shopping, 40000, "12", "生活用品");
  add(transport, 20000, "15", "地铁出行");
  repo.saveTxn({
    type: "income",
    categoryId: initial.categories.find(
      (c) => c.kind === "income" && !c.deleted,
    )!.id,
    amount: 1500000,
    occurredAt: `${month}-01`,
    accountId,
    forWhom: "both",
    note: "示例 · 本月工资",
  });
  repo.setMonthBudget(month, 1000000, {
    [housing]: 600000,
    [rent]: 450000,
    [utilities]: 100000,
    [digital]: 50000,
    [subscriptions]: 50000,
    [dining]: 200000,
    [meals]: 200000,
    [goods]: 100000,
    [shopping]: 100000,
    [travel]: 50000,
    [transport]: 50000,
  });
}
