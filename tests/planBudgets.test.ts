import { fixture } from "./sqlite";
import {
  linkedBudget,
  monthBudgetView,
  planMonthAmounts,
  unbudgetedClosedCategories,
} from "../src/domain/planBudgets";
import { budgetAddition, categoryBudgetUsage } from "../src/domain/budgets";
import { loanExpenseTxns } from "../src/domain/selectors";
import type { Snapshot } from "../src/domain/types";

const s0 = (f: ReturnType<typeof fixture>) => f.repo.snapshot();

function carLoan(f: ReturnType<typeof fixture>) {
  const bank = f.repo.snapshot().accounts[0]!.id;
  f.repo.saveLoan({
    name: "车贷",
    principal: 300000,
    date: "2026-10-01",
    receiveAccountId: null,
    paymentAccountId: bank,
    oneTime: false,
    unit: "month",
    every: 1,
    periods: 3,
    installment: null,
    freePeriods: 0,
    paidPeriods: 0,
    firstDue: "2026-11-15",
    countAsExpense: true,
  });
  const s = f.repo.snapshot();
  const plan = s.plans.find((p) => p.kind === "loan")!;
  return { s, categoryId: JSON.parse(plan.data).expenseCategoryId as string };
}

test("loan installments are planned month by month and drop to zero once repaid", () => {
  const f = fixture();
  try {
    const { s, categoryId } = carLoan(f);
    expect(planMonthAmounts(s, "2026-11").get(categoryId)).toBe(100000);
    expect(planMonthAmounts(s, "2027-01").get(categoryId)).toBe(100000);
    expect(planMonthAmounts(s, "2027-02").get(categoryId)).toBe(0);
  } finally {
    f.sqlite.close();
  }
});

test("lease rent is planned for its months only", () => {
  const f = fixture();
  try {
    const s = f.repo.snapshot();
    const rent = s.categories.find((c) => c.name === "房租")!;
    const lease = {
      ...s,
      plans: [
        {
          id: "lease",
          kind: "prepaid",
          name: "租房",
          scope: "family",
          createdAt: "",
          updatedAt: "",
          hlc: "",
          deleted: false,
          data: JSON.stringify({
            categoryId: rent.id,
            lease: {
              start: "2026-01-01",
              end: "2026-12-31",
              cycle: "month",
              rent: 300000,
              split: "month",
            },
          }),
        },
      ],
    } as Snapshot;
    expect(planMonthAmounts(lease, "2026-11").get(rent.id)).toBe(300000);
    expect(planMonthAmounts(lease, "2027-01").get(rent.id)).toBe(0);
  } finally {
    f.sqlite.close();
  }
});

test("a linked budget follows its plan from this month on and leaves the total when the plan ends", () => {
  const f = fixture();
  try {
    const { s, categoryId } = carLoan(f);
    const parent = s.categories.find((c) => c.id === categoryId)!.parentId!;
    const saved = { [parent]: 150000, [categoryId]: 100000 };
    const amounts = planMonthAmounts(s, "2027-02");
    const onTop = [{ id: categoryId, total: true }];
    expect(
      linkedBudget("2027-02", 500000, saved, onTop, amounts, s.categories, "2026-11-02"),
    ).toMatchObject({
      total: 400000,
      allocations: { [parent]: 50000, [categoryId]: 0 },
    });
    // Carved out of existing room: the room goes back, the total stays.
    expect(
      linkedBudget("2027-02", 500000, saved, [{ id: categoryId, total: false }], amounts, s.categories, "2026-11-02"),
    ).toMatchObject({
      total: 500000,
      allocations: { [parent]: 150000, [categoryId]: 0 },
    });
    // Months already over keep what was saved.
    expect(
      linkedBudget("2027-02", 500000, saved, onTop, amounts, s.categories, "2027-03-01"),
    ).toMatchObject({ total: 500000, allocations: saved });
    // Without the link nothing moves.
    expect(
      linkedBudget("2027-02", 500000, saved, [], amounts, s.categories, "2026-11-02").total,
    ).toBe(500000);
  } finally {
    f.sqlite.close();
  }
});

test("a closed category without a budget is offered its plan amount, added to the total and linked", () => {
  const f = fixture();
  try {
    const { categoryId } = carLoan(f);
    // Every yuan of the total is already allocated, so the loan goes on top.
    const other = s0(f).categories.find(
      (c) => c.kind === "expense" && !c.parentId && c.name !== "大额支出",
    )!;
    f.repo.setMonthBudget("2026-11", 500000, { [other.id]: 500000 });
    f.repo.setDetailBudgetPreferences({
      excludedCategoryIds: [categoryId],
      title: "",
    });
    const s = f.repo.snapshot();
    const spending = loanExpenseTxns(s.txns, s.plans);
    const rows = unbudgetedClosedCategories(
      s,
      "2026-11",
      f.repo.monthAllocations("2026-11"),
      [categoryId],
      (m) => categoryBudgetUsage(spending, s.categories, m),
      planMonthAmounts(s, "2026-11"),
    );
    expect(rows).toHaveLength(1);
    expect(rows[0]).toMatchObject({ planned: true, suggested: 100000 });
    f.repo.addCategoryBudget("2026-11", categoryId, 100000, true);
    expect(f.repo.monthBudget("2026-11")).toBe(600000);
    expect(f.repo.getLinkedBudgetCategories()).toEqual([
      { id: categoryId, total: true },
    ]);
    expect(
      monthBudgetView(
        f.repo.snapshot(),
        "2027-02",
        f.repo.monthBudget("2027-02"),
        f.repo.monthAllocations("2027-02"),
        f.repo.getLinkedBudgetCategories(),
        "2026-11-02",
      ).total,
    ).toBe(500000);
    expect(() =>
      f.repo.addCategoryBudget("2026-11", categoryId, 100000, true),
    ).toThrow("已设置");
  } finally {
    f.sqlite.close();
  }
});

test("a zero budget counts as missing, and carving a child out of its parent's room keeps the total", () => {
  const f = fixture();
  try {
    const s = f.repo.snapshot();
    const rent = s.categories.find((c) => c.name === "房租")!;
    const utilities = s.categories.find(
      (c) => c.parentId === rent.parentId && c.id !== rent.id,
    )!;
    const allocations = { [rent.parentId!]: 600000, [rent.id]: 0, [utilities.id]: 100000 };
    expect(
      budgetAddition(1000000, allocations, s.categories, rent.id, 450000),
    ).toMatchObject({
      total: 1000000,
      raised: 0,
      allocations: { [rent.parentId!]: 600000, [rent.id]: 450000 },
    });
    // The parent lacks 50,000: it and the full total grow by exactly that.
    expect(
      budgetAddition(600000, allocations, s.categories, rent.id, 550000),
    ).toMatchObject({
      total: 650000,
      raised: 50000,
      allocations: { [rent.parentId!]: 650000 },
    });
    f.repo.setMonthBudget("2026-11", 1000000, allocations);
    f.repo.saveTxn({
      type: "expense",
      amount: 450000,
      accountId: s.accounts[0]!.id,
      categoryId: rent.id,
      occurredAt: "2026-11-01",
      note: "",
      forWhom: "both",
    });
    const after = f.repo.snapshot();
    const rows = unbudgetedClosedCategories(
      after,
      "2026-11",
      f.repo.monthAllocations("2026-11"),
      [rent.id],
      (m) => categoryBudgetUsage(after.txns, after.categories, m),
      new Map(),
    );
    expect(rows.map((r) => [r.category.id, r.suggested])).toEqual([[rent.id, 450000]]);
    f.repo.addCategoryBudget("2026-11", rent.id, 450000, false);
    expect(f.repo.monthBudget("2026-11")).toBe(1000000);
    expect(f.repo.monthAllocations("2026-11")[rent.id]).toBe(450000);
  } finally {
    f.sqlite.close();
  }
});
