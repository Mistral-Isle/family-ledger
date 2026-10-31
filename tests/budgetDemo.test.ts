import { fixture } from "./sqlite";
import { seedBudgetDemo } from "../src/demo/seedBudgetDemo";
import { detailBudget } from "../src/domain/budgets";
import { totals } from "../src/domain/selectors";

test("demo keeps agreed categories and housing exclusion changes 10000/6800/3200 to 4000/2000/2000", () => {
  const f = fixture();
  try {
    const categories = f.repo.snapshot().categories;
    seedBudgetDemo(f.repo, "2026-10");
    const before = f.repo.snapshot();
    expect(before.categories).toEqual(categories);
    const allocations = f.repo.monthAllocations("2026-10");
    const housing = before.categories.find((c) => c.name === "居住")!;
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
      excludedCategoryIds: [housing.id],
      title: "",
    });
    expect(calculate()).toMatchObject({
      budget: 400000,
      expense: 200000,
      remaining: 200000,
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
