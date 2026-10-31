import { randomUUID } from "node:crypto";
import { LedgerRepository } from "../src/db/repository";
import { donutLabels, donutSlices, shareLabel } from "../src/domain/donut";
import { categoryReport, reportRange } from "../src/domain/reports";
import { fixture } from "./sqlite";

test("calendar defaults to visible and persists independently of ledger and sync records", () => {
  const f = fixture();
  try {
    const before = f.repo.snapshot();
    expect(f.repo.getShowIncomeCalendar()).toBe(true);
    f.repo.setShowIncomeCalendar(false);
    const reopened = new LedgerRepository(f.driver, randomUUID);
    reopened.initialize();
    expect(reopened.getShowIncomeCalendar()).toBe(false);
    expect(reopened.snapshot()).toEqual(before);
    reopened.setShowIncomeCalendar(true);
    expect(
      new LedgerRepository(f.driver, randomUUID).getShowIncomeCalendar(),
    ).toBe(true);
  } finally {
    f.sqlite.close();
  }
});

test("donut preserves every positive category, with no negative slices", () => {
  const items = Array.from({ length: 12 }, (_, i) => ({
    id: String(i),
    name: `分类${i}`,
    amount: i === 0 ? -10 : i,
    color: "#FFFFFF",
  }));
  const slices = donutSlices(items);
  expect(slices).toHaveLength(11);
  expect(slices.every((s) => s.id !== "donut-other")).toBe(true);
  expect(slices.reduce((sum, s) => sum + s.amount, 0)).toBe(66);
  expect(slices.reduce((sum, s) => sum + s.share, 0)).toBeCloseTo(1);
  expect(donutSlices([{ ...items[0]!, amount: 0 }])).toEqual([]);
  expect(donutSlices([{ ...items[0]!, amount: 1 }])[0]?.share).toBe(1);
  expect(shareLabel(1, 3)).toBe("33.33%");
  expect(shareLabel(-1, 3)).toBe("—");
});

test("clustered outside labels remain separated and inside a small chart", () => {
  const slices = donutSlices(
    Array.from({ length: 6 }, (_, i) => ({
      id: String(i),
      name: `分类${i}`,
      amount: i ? 1 : 1000,
      color: "#FFFFFF",
    })),
  );
  const labels = donutLabels(slices, 140, 80, 280);
  for (const side of [-1, 1]) {
    const group = labels
      .filter((label) => label.side === side)
      .sort((a, b) => a.y - b.y);
    group.forEach((label, i) => {
      expect(label.y).toBeGreaterThanOrEqual(28);
      expect(label.y).toBeLessThanOrEqual(252);
      if (i) expect(label.y - group[i - 1]!.y).toBeGreaterThanOrEqual(36);
    });
  }
});

test("category counts include only transactions contributing to the selected kind, with parent rollup", () => {
  const f = fixture();
  try {
    const s = f.repo.snapshot();
    const child = s.categories.find((c) => c.kind === "expense" && c.parentId)!;
    const common = {
      accountId: s.accounts[0]!.id,
      occurredAt: "2026-10-10",
      note: "",
      forWhom: "both" as const,
    };
    f.repo.saveTxn({
      ...common,
      type: "expense",
      categoryId: child.id,
      amount: 1000,
    });
    f.repo.saveTxn({
      ...common,
      type: "refund",
      refundOfId: f.repo.snapshot().txns[0]!.id,
      amount: 1200,
    });
    f.repo.saveTxn({
      ...common,
      type: "transfer",
      toAccountId: s.accounts[1]!.id,
      amount: 100,
    });
    const next = f.repo.snapshot(),
      range = reportRange("month", common.occurredAt, []);
    expect(
      categoryReport(next, range, "expense", "root").find(
        (c) => c.id === child.parentId,
      ),
    ).toMatchObject({ amount: 0, count: 2 });
    expect(categoryReport(next, range, "income", "leaf")[0]).toMatchObject({
      amount: 200,
      count: 1,
    });
    expect(
      categoryReport(
        {
          ...next,
          txns: next.txns.map((txn) => ({ ...txn, discarded: true })),
        },
        range,
        "expense",
        "root",
      ),
    ).toEqual([]);
  } finally {
    f.sqlite.close();
  }
});
