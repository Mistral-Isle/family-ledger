import {
  reportRange,
  previousRange,
  rangeDays,
  averageExpense,
  categoryReport,
  dailyReport,
} from "../src/domain/reports";
import { fixture } from "./sqlite";
test("calendar periods handle Monday, leap years and prior calendar month", () => {
  expect(reportRange("week", "2026-11-01", [])).toEqual({
    start: "2026-10-26",
    end: "2026-11-01",
  });
  const month = reportRange("month", "2024-03-10", []);
  expect(previousRange("month", month)).toEqual({
    start: "2024-02-01",
    end: "2024-02-29",
  });
  expect(rangeDays(reportRange("year", "2024-05-01", []))).toBe(366);
  expect(() =>
    reportRange("custom", "2026-10-30", [], {
      start: "2026-10-30",
      end: "2026-10-01",
    }),
  ).toThrow();
  expect(averageExpense(100, 3)).toBe(33);
  expect(averageExpense(-101, 2)).toBe(-51);
});
test("category hierarchy and daily totals share refund and private exclusion rules", () => {
  const f = fixture();
  try {
    const s = f.repo.snapshot(),
      child = s.categories.find((c) => c.kind === "expense" && c.parentId)!;
    f.repo.saveTxn({
      type: "expense",
      amount: 10000,
      categoryId: child.id,
      accountId: s.accounts[0]!.id,
      occurredAt: "2026-10-01",
      note: "",
      forWhom: "both",
    });
    f.repo.saveTxn({
      type: "refund",
      amount: 12000,
      refundOfId: f.repo.snapshot().txns[0]!.id,
      accountId: s.accounts[0]!.id,
      occurredAt: "2026-10-02",
      note: "",
      forWhom: "both",
    });
    const next = f.repo.snapshot(),
      range = reportRange("month", "2026-10-01", next.txns);
    expect(categoryReport(next, range, "expense", "root")[0]).toMatchObject({
      id: child.parentId,
      amount: 0,
    });
    expect(categoryReport(next, range, "income", "root")[0]!.amount).toBe(2000);
    const days = dailyReport(next.txns, "2026-10");
    expect(days).toHaveLength(31);
    expect(days[1]).toMatchObject({ expense: -10000, income: 2000 });
    next.txns.forEach((t) => (t.scope = "private"));
    expect(categoryReport(next, range, "income", "root")).toEqual([]);
  } finally {
    f.sqlite.close();
  }
});
