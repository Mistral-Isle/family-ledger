import { fixture } from "./sqlite";
import { validateBudgetAllocation } from "../src/domain/budgets";

test("budget allocation is atomic, enforces both hierarchy levels and supports zero", () => {
  const f = fixture();
  try {
    const cats = f.repo.snapshot().categories;
    const child = cats.find((c) => c.kind === "expense" && c.parentId)!;
    const root = child.parentId!;
    f.repo.setMonthBudget("2026-10", 10000, { [root]: 8000, [child.id]: 5000 });
    expect(f.repo.monthAllocations("2026-10")).toEqual({
      [root]: 8000,
      [child.id]: 5000,
    });
    expect(() => f.repo.setMonthBudget("2026-10", 7000)).toThrow("总预算");
    expect(() =>
      f.repo.setMonthBudget("2026-10", 10000, {
        [root]: 3000,
        [child.id]: 5000,
      }),
    ).toThrow("二级预算");
    expect(() =>
      f.repo.setMonthBudget("2026-10", 10000, { [child.id]: 5000 }),
    ).toThrow("一级预算");
    expect(() => f.repo.setMonthBudget("2026-10", null)).toThrow("总预算");
    expect(f.repo.monthBudget("2026-10")).toBe(10000);
    f.repo.setMonthBudget("2026-10", 0, {});
    expect(f.repo.monthBudget("2026-10")).toBe(0);
    f.repo.setMonthBudget("2026-10", null, {});
    expect(f.repo.monthBudget("2026-10")).toBeNull();
  } finally {
    f.sqlite.close();
  }
});

test("sum of root budgets is bounded and invalid categories/amounts are rejected", () => {
  const f = fixture();
  try {
    const cats = f.repo.snapshot().categories,
      roots = cats.filter((c) => c.kind === "expense" && !c.parentId);
    expect(() =>
      validateBudgetAllocation(
        100,
        { [roots[0]!.id]: 60, [roots[1]!.id]: 60 },
        cats,
      ),
    ).toThrow("一级分类");
    expect(() =>
      validateBudgetAllocation(100, { [roots[0]!.id]: -1 }, cats),
    ).toThrow();
    expect(() =>
      validateBudgetAllocation(100, { missing: 10 }, cats),
    ).toThrow();
  } finally {
    f.sqlite.close();
  }
});

test("optional time and allocations survive backup and merge with legacy logs", () => {
  const f = fixture(),
    g = fixture();
  try {
    const data = f.repo.snapshot(),
      cat = data.categories.find((c) => c.kind === "expense" && c.parentId)!;
    const account = data.accounts.find((a) => a.scope === "family")!;
    f.repo.setMonthBudget("2026-10", 10000, {
      [cat.parentId!]: 8000,
      [cat.id]: 5000,
    });
    f.repo.saveTxn({
      type: "expense",
      amount: 100,
      accountId: account.id,
      categoryId: cat.id,
      occurredAt: "2026-10-30",
      occurredTime: "23:59",
      note: "test",
      forWhom: "both",
    });
    const row = f.repo.snapshot().txns.find((t) => t.note === "test")!;
    expect(row.occurredTime).toBe("23:59");
    expect(() => f.repo.saveTxn({ ...row, occurredTime: "24:01" })).toThrow(
      "时间",
    );
    g.repo.restoreBackup(f.repo.exportBackup());
    expect(g.repo.monthAllocations("2026-10")).toEqual(
      f.repo.monthAllocations("2026-10"),
    );
    expect(
      g.repo.snapshot().txns.find((t) => t.id === row.id)?.occurredTime,
    ).toBe("23:59");
    f.repo.saveTxn({ ...row, occurredTime: null });
    expect(
      f.repo.snapshot().txns.find((t) => t.id === row.id)?.occurredTime,
    ).toBeNull();
    const legacy = JSON.parse(f.repo.exportBackup());
    legacy.version = 3;
    legacy.tables.txn.forEach((t: any) => delete t.occurred_time);
    legacy.tables.budget.forEach((b: any) => delete b.allocations);
    g.repo.restoreBackup(JSON.stringify(legacy));
    expect(g.repo.monthAllocations("2026-10")).toEqual({});
    expect(
      g.repo.snapshot().txns.find((t) => t.id === row.id)?.occurredTime,
    ).toBeNull();
  } finally {
    f.sqlite.close();
    g.sqlite.close();
  }
});
