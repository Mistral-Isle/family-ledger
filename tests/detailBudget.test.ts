import { randomUUID } from "node:crypto";
import { detailBudget } from "../src/domain/budgets";
import { LedgerRepository } from "../src/db/repository";
import { accountBalance, totals } from "../src/domain/selectors";
import { filterMonthTransactions } from "../src/domain/transactionFilters";
import { reportingSnapshot } from "../src/domain/reports";
import { fixture } from "./sqlite";

test("parent and child exclusions adjust all budget metrics once, with refunds and unallocated amounts", () => {
  const f = fixture();
  try {
    const initial = f.repo.snapshot();
    const child = initial.categories.find(
      (c) => c.kind === "expense" && c.parentId,
    )!;
    const root = child.parentId!;
    const other = initial.categories.find(
      (c) => c.kind === "expense" && !c.parentId && c.id !== root,
    )!;
    const account = initial.accounts[0]!;
    const common = {
      accountId: account.id,
      occurredAt: "2026-10-10",
      note: "",
      forWhom: "both" as const,
    };
    f.repo.saveTxn({
      ...common,
      type: "expense",
      categoryId: child.id,
      amount: 3000,
    });
    const original = f.repo.snapshot().txns[0]!;
    f.repo.saveTxn({
      ...common,
      type: "refund",
      refundOfId: original.id,
      amount: 1000,
    });
    f.repo.saveTxn({
      ...common,
      type: "expense",
      categoryId: root,
      amount: 500,
    });
    f.repo.saveTxn({
      ...common,
      type: "expense",
      categoryId: other.id,
      amount: 1500,
    });
    f.repo.saveTxn({
      ...common,
      type: "expense",
      categoryId: other.id,
      amount: 999,
      occurredAt: "2026-11-01",
    });
    const allocations = { [root]: 6000, [child.id]: 4000, [other.id]: 2000 };
    f.repo.setMonthBudget("2026-10", 10000, allocations);
    const before = f.repo.snapshot();
    const project = (ids: string[], total: number | null = 10000, title = "") =>
      detailBudget(
        before.txns,
        before.categories,
        "2026-10",
        total,
        allocations,
        { excludedCategoryIds: ids, title },
      );
    expect(project([])).toMatchObject({
      title: "本月预算",
      budget: 10000,
      expense: 4000,
      remaining: 6000,
      progress: 0.4,
      filtered: false,
    });
    expect(project([child.id])).toMatchObject({
      title: "所选分类预算",
      budget: 6000,
      expense: 2000,
      remaining: 4000,
    });
    expect(project([root, child.id])).toMatchObject({
      budget: 4000,
      expense: 1500,
      remaining: 2500,
      progress: 0.375,
    });
    expect(project([root, child.id], 10000, " 日常预算 ").title).toBe(
      "日常预算",
    );
    expect(project([root], null)).toMatchObject({
      budget: null,
      remaining: null,
      progress: 0,
    });
    expect(
      project(
        before.categories
          .filter((c) => c.kind === "expense" && !c.parentId)
          .map((c) => c.id),
      ),
    ).toMatchObject({ budget: 0, expense: 0, remaining: 0, progress: 0 });
    const unbudgeted = before.categories.find(
      (c) => c.parentId === root && c.id !== child.id,
    )!;
    expect(project([unbudgeted.id]).budget).toBe(10000);
    const balance = accountBalance(account, before.txns);
    const records = filterMonthTransactions(before, "2026-10", [], "");
    f.repo.setDetailBudgetPreferences({
      excludedCategoryIds: [root, child.id],
      title: "日常预算",
    });
    const reopened = new LedgerRepository(f.driver, randomUUID);
    reopened.initialize();
    expect(reopened.getDetailBudgetPreferences()).toEqual({
      excludedCategoryIds: [root, child.id],
      title: "日常预算",
    });
    expect(reopened.snapshot()).toEqual(before);
    expect(reopened.monthBudget("2026-10")).toBe(10000);
    expect(reopened.monthAllocations("2026-10")).toEqual(allocations);
    expect(accountBalance(account, reopened.snapshot().txns)).toBe(balance);
    expect(
      filterMonthTransactions(reopened.snapshot(), "2026-10", [], ""),
    ).toEqual(records);
    expect(
      totals(reportingSnapshot(reopened.snapshot(), "", false).txns).expense,
    ).toBe(4999);
    reopened.setDetailBudgetPreferences({ excludedCategoryIds: [], title: "" });
    expect(
      detailBudget(
        before.txns,
        before.categories,
        "2026-10",
        10000,
        allocations,
        reopened.getDetailBudgetPreferences(),
      ).title,
    ).toBe("本月预算");
  } finally {
    f.sqlite.close();
  }
});

test("zero budgets, overspend, negative refunds and obsolete category preferences remain safe", () => {
  const f = fixture();
  try {
    const s = f.repo.snapshot();
    const cat = s.categories.find((c) => c.kind === "expense" && c.parentId)!;
    f.repo.saveTxn({
      type: "expense",
      amount: 500,
      accountId: s.accounts[0]!.id,
      categoryId: cat.id,
      occurredAt: "2026-09-01",
      note: "",
      forWhom: "me",
    });
    f.repo.saveTxn({
      type: "refund",
      amount: 300,
      refundOfId: f.repo.snapshot().txns[0]!.id,
      accountId: s.accounts[0]!.id,
      occurredAt: "2026-10-01",
      note: "",
      forWhom: "me",
    });
    const rows = f.repo.snapshot().txns;
    const preferences = {
      excludedCategoryIds: ["removed-category"],
      title: "",
    };
    expect(
      detailBudget(rows, s.categories, "2026-10", 0, {}, preferences),
    ).toMatchObject({
      title: "本月预算",
      expense: -300,
      remaining: 300,
      progress: 0,
    });
    expect(
      detailBudget(rows, s.categories, "2026-09", 0, {}, preferences),
    ).toMatchObject({ expense: 500, remaining: -500, progress: 1 });
    f.repo.setDetailBudgetPreferences(preferences);
    expect(f.repo.getDetailBudgetPreferences().excludedCategoryIds).toEqual([]);
    expect(() =>
      f.repo.setDetailBudgetPreferences({
        ...preferences,
        title: "长".repeat(31),
      }),
    ).toThrow("30");
  } finally {
    f.sqlite.close();
  }
});
