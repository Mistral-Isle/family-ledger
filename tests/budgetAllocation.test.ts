import { fixture } from "./sqlite";
import {
  budgetAllocationWarnings,
  detailBudget,
  validateBudgetAllocation,
} from "../src/domain/budgets";

test("budget allocation is atomic, allows over-allocation and supports zero", () => {
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
    // Hierarchy overruns are saved as typed and only reported as warnings.
    f.repo.setMonthBudget("2026-10", 7000);
    expect(f.repo.monthBudget("2026-10")).toBe(7000);
    f.repo.setMonthBudget("2026-10", 10000, { [root]: 3000, [child.id]: 5000 });
    expect(
      budgetAllocationWarnings(
        10000,
        f.repo.monthAllocations("2026-10"),
        f.repo.snapshot().categories,
      ),
    ).toMatchObject({ rootOver: 0, children: { [root]: { sum: 5000, over: 2000 } } });
    f.repo.setMonthBudget("2026-10", 10000, { [child.id]: 5000 });
    expect(f.repo.monthAllocations("2026-10")).toEqual({ [child.id]: 5000 });
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

test("root budgets over the total are reported and invalid categories/amounts are rejected", () => {
  const f = fixture();
  try {
    const cats = f.repo.snapshot().categories,
      roots = cats.filter((c) => c.kind === "expense" && !c.parentId);
    const over = { [roots[0]!.id]: 60, [roots[1]!.id]: 60 };
    expect(validateBudgetAllocation(100, over, cats)).toBe(over);
    expect(budgetAllocationWarnings(100, over, cats)).toMatchObject({
      rootSum: 120,
      rootOver: 20,
    });
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

test("new budgets and optional time synchronize; a budgeted child can move parents", () => {
  const a = fixture(),
    b = fixture();
  try {
    b.repo.prepareJoin("另一位");
    b.repo.mergeOperations(a.repo.pendingOperations());
    const s = a.repo.snapshot(),
      child = s.categories.find((c) => c.kind === "expense" && c.parentId)!,
      other = s.categories.find(
        (c) => c.kind === "expense" && !c.parentId && c.id !== child.parentId,
      )!;
    a.repo.setMonthBudget("2026-10", 10000, {
      [child.parentId!]: 8000,
      [child.id]: 5000,
    });
    a.repo.saveTxn({
      type: "expense",
      amount: 50,
      accountId: s.accounts[0]!.id,
      categoryId: child.id,
      occurredAt: "2026-10-30",
      occurredTime: "09:20",
      note: "同步时间",
      forWhom: "both",
    });
    b.repo.mergeOperations(a.repo.pendingOperations());
    expect(b.repo.monthAllocations("2026-10")).toEqual(
      a.repo.monthAllocations("2026-10"),
    );
    expect(
      b.repo.snapshot().txns.find((t) => t.note === "同步时间")?.occurredTime,
    ).toBe("09:20");
    a.repo.saveCategory({ ...child, parentId: other.id });
    expect(
      a.repo.snapshot().categories.find((c) => c.id === child.id)?.parentId,
    ).toBe(other.id);
  } finally {
    a.sqlite.close();
    b.sqlite.close();
  }
});

test("an excluded parent without its own amount releases what its children add up to", () => {
  const f = fixture();
  try {
    const cats = f.repo.snapshot().categories;
    const child = cats.find((c) => c.kind === "expense" && c.parentId)!;
    const sibling = cats.find(
      (c) => c.parentId === child.parentId && c.id !== child.id,
    )!;
    const allocations = { [child.id]: 3000, [sibling.id]: 1000 };
    expect(
      detailBudget([], cats, "2026-10", 10000, allocations, {
        excludedCategoryIds: [child.parentId!],
        title: "",
      }).budget,
    ).toBe(6000);
  } finally {
    f.sqlite.close();
  }
});
