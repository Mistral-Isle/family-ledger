import { fixture } from "./sqlite";
import {
  linkedBudget,
  monthBudgetView,
  planMonthAmounts,
  unbudgetedClosedCategories,
} from "../src/domain/planBudgets";
import { categoryBudgetUsage } from "../src/domain/budgets";
import { loanExpenseTxns } from "../src/domain/selectors";
import type { Snapshot } from "../src/domain/types";

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
    expect(
      linkedBudget("2027-02", 500000, saved, [categoryId], amounts, s.categories, "2026-11-02"),
    ).toMatchObject({
      total: 400000,
      allocations: { [parent]: 50000, [categoryId]: 0 },
    });
    // Months already over keep what was saved.
    expect(
      linkedBudget("2027-02", 500000, saved, [categoryId], amounts, s.categories, "2027-03-01"),
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
    f.repo.setMonthBudget("2026-11", 500000, {});
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
    expect(f.repo.getLinkedBudgetCategories()).toEqual([categoryId]);
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
