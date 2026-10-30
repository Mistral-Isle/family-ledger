import type { LedgerRepository } from "../db/repository";
import { validDate } from "../domain/date";

/** Called only after opening the dedicated demo database. Never replaces existing records. */
export function seedBudgetDemo(repo: LedgerRepository, month: string) {
  validDate(month + "-01");
  const initial = repo.snapshot();
  if (initial.txns.length || initial.budgets.length || initial.plans.length)
    return;
  const category = (
    name: string,
    parentId: string | null,
    icon: string,
    sort: number,
  ) => {
    const existing = repo
      .snapshot()
      .categories.find(
        (c) =>
          !c.deleted &&
          c.kind === "expense" &&
          c.name === name &&
          c.parentId === parentId,
      );
    repo.saveCategory({
      id: existing?.id,
      name,
      kind: "expense",
      parentId,
      icon,
      color: parentId ? "#648BD2" : "#007AFF",
      sort,
    });
    return repo
      .snapshot()
      .categories.find(
        (c) =>
          !c.deleted &&
          c.kind === "expense" &&
          c.name === name &&
          c.parentId === parentId,
      )!.id;
  };
  const fixed = category("固定支出", null, "house.fill", -2);
  const rent = category("房租", fixed, "house.fill", 0);
  const utilities = category("水电燃气", fixed, "bolt.fill", 1);
  const subscriptions = category("通讯订阅", fixed, "iphone", 2);
  const daily = category("日常", null, "basket.fill", -1);
  const meals = category("三餐", daily, "fork.knife", 0);
  const shopping = category("生活用品", daily, "cart.fill", 1);
  const transport = category("日常交通", daily, "tram.fill", 2);
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
  add(subscriptions, 20000, "06", "手机话费与订阅");
  add(meals, 120000, "10", "日常餐饮");
  add(shopping, 40000, "12", "生活用品");
  add(transport, 20000, "15", "地铁与打车");
  repo.saveTxn({
    type: "income",
    categoryId: initial.categories.find(
      (c) => c.kind === "income" && c.parentId,
    )!.id,
    amount: 1500000,
    occurredAt: `${month}-01`,
    accountId,
    forWhom: "both",
    note: "示例 · 本月工资",
  });
  repo.setMonthBudget(month, 1000000, {
    [fixed]: 600000,
    [rent]: 450000,
    [utilities]: 100000,
    [subscriptions]: 50000,
    [daily]: 400000,
    [meals]: 250000,
    [shopping]: 100000,
    [transport]: 50000,
  });
}
