import { fixture } from "./sqlite";
import { seedBudgetDemo } from "../src/demo/seedBudgetDemo";
import { detailBudget } from "../src/domain/budgets";
import { totals } from "../src/domain/selectors";

test("demo is repeatable and fixed expenses toggle 10000/6800/3200 to 4000/1800/2200", () => {
  const f = fixture();
  try {
    seedBudgetDemo(f.repo, "2026-10");
    const before = f.repo.snapshot();
    const allocations = f.repo.monthAllocations("2026-10");
    const fixed = before.categories.find((c) => c.name === "固定支出")!;
    const calculate = () =>
      detailBudget(
        before.txns,
        before.categories,
        "2026-10",
        f.repo.monthBudget("2026-10"),
        allocations,
        f.repo.getDetailBudgetPreferences(),
      );
    expect(calculate()).toMatchObject({
      budget: 1000000,
      expense: 680000,
      remaining: 320000,
    });
    f.repo.setDetailBudgetPreferences({
      excludedCategoryIds: [fixed.id],
      title: "",
    });
    expect(calculate()).toMatchObject({
      budget: 400000,
      expense: 180000,
      remaining: 220000,
    });
    expect(totals(f.repo.snapshot().txns).expense).toBe(680000);
    expect(f.repo.monthBudget("2026-10")).toBe(1000000);
    seedBudgetDemo(f.repo, "2026-10");
    expect(f.repo.snapshot()).toEqual(before);
    expect(calculate().title).toBe("所选分类预算");
  } finally {
    f.sqlite.close();
  }
});
