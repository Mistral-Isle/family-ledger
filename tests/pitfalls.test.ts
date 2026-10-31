import { fixture } from "./sqlite";
import { accountBalance, totals } from "../src/domain/selectors";
import { filterMonthTransactions } from "../src/domain/transactionFilters";

test("editing amount, account and month then deleting keeps balances and reports consistent", () => {
  const f = fixture();
  try {
    const s = f.repo.snapshot();
    f.repo.saveTxn({
      type: "expense",
      amount: 10000,
      accountId: s.accounts[0]!.id,
      categoryId: s.categories.find((c) => c.kind === "expense")!.id,
      occurredAt: "2026-10-30",
      note: "对账链",
      forWhom: "both",
    });
    const row = f.repo.snapshot().txns[0]!;
    f.repo.saveTxn({ ...row, amount: 8000 });
    expect(accountBalance(s.accounts[0]!, f.repo.snapshot().txns)).toBe(-8000);
    f.repo.saveTxn({
      ...row,
      amount: 8000,
      accountId: s.accounts[1]!.id,
      occurredAt: "2026-09-30",
    });
    const changed = f.repo.snapshot();
    expect(accountBalance(s.accounts[0]!, changed.txns)).toBe(0);
    expect(accountBalance(s.accounts[1]!, changed.txns)).toBe(-8000);
    expect(
      filterMonthTransactions(changed, "2026-10", [], "对账链"),
    ).toHaveLength(0);
    expect(
      totals(filterMonthTransactions(changed, "2026-09", [], "对账链")).expense,
    ).toBe(8000);
    f.repo.deleteTxn(row.id);
    expect(
      f.repo
        .snapshot()
        .accounts.map((a) => accountBalance(a, f.repo.snapshot().txns)),
    ).toEqual([0, 0, 0]);
    expect(totals(f.repo.snapshot().txns)).toEqual({
      expense: 0,
      income: 0,
      balance: 0,
    });
  } finally {
    f.sqlite.close();
  }
});

test.each([
  ["appearance", "unknown"],
  ["includeRepayments", "false"],
  ["showIncomeCalendar", 0],
  ["detailBudgetPreferences", { title: null, excludedCategoryIds: [] }],
  ["detailBudgetPreferences", { title: "预算", excludedCategoryIds: [123] }],
])(
  "rejects invalid restored preference %s without replacing data",
  (key, value) => {
    const f = fixture();
    try {
      const before = JSON.parse(f.repo.exportBackup());
      const damaged = structuredClone(before);
      damaged.tables.local_pref.push({ key, value: JSON.stringify(value) });
      expect(() => f.repo.restoreBackup(JSON.stringify(damaged))).toThrow();
      expect(JSON.parse(f.repo.exportBackup()).tables).toEqual(before.tables);
    } finally {
      f.sqlite.close();
    }
  },
);

test("a deleted child does not break backup after its former parent moves; undo cannot create a third level", () => {
  const f = fixture();
  const g = fixture();
  try {
    f.repo.saveCategory({
      name: "临时父类",
      kind: "expense",
      parentId: null,
      icon: "bag",
      color: "#648BD2",
    });
    const parent = f.repo
      .snapshot()
      .categories.find((c) => c.name === "临时父类")!;
    f.repo.saveCategory({
      name: "临时子类",
      kind: "expense",
      parentId: parent.id,
      icon: "bag",
      color: "#648BD2",
    });
    const child = f.repo
      .snapshot()
      .categories.find((c) => c.name === "临时子类")!;
    f.repo.deleteCategory(child.id, { action: "discard" });
    const target = f.repo
      .snapshot()
      .categories.find(
        (c) => c.kind === "expense" && !c.parentId && c.id !== parent.id,
      )!;
    f.repo.saveCategory({ ...parent, parentId: target.id });
    const before = f.repo.snapshot();
    g.repo.restoreBackup(f.repo.exportBackup());
    expect(g.repo.snapshot()).toEqual(before);
    expect(() =>
      f.repo.restoreCategoryDeletion(f.repo.categoryDeletionHistory()[0]!.id),
    ).toThrow();
    expect(f.repo.snapshot()).toEqual(before);
    f.repo.saveCategory({ ...parent, parentId: null });
    f.repo.restoreCategoryDeletion(f.repo.categoryDeletionHistory()[0]!.id);
    expect(
      f.repo.snapshot().categories.find((c) => c.id === child.id)?.deleted,
    ).toBe(false);
  } finally {
    f.sqlite.close();
    g.sqlite.close();
  }
});

test("stale local category exclusions after joining a family do not invalidate a backup", () => {
  const f = fixture();
  try {
    const category = f.repo
      .snapshot()
      .categories.find((c) => c.kind === "expense")!;
    f.repo.setDetailBudgetPreferences({
      title: "生活",
      excludedCategoryIds: [category.id],
    });
    f.repo.prepareJoin("另一位");
    const before = f.repo.snapshot();
    f.repo.restoreBackup(f.repo.exportBackup());
    expect(f.repo.snapshot()).toEqual(before);
  } finally {
    f.sqlite.close();
  }
});
