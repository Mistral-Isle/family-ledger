import { randomUUID } from "node:crypto";
import { LedgerRepository } from "../src/db/repository";
import { donutLabels, donutSlices, shareLabel } from "../src/domain/donut";
import {
  categoryDetailReport,
  categoryReport,
  reportingSnapshot,
  reportRange,
} from "../src/domain/reports";
import { fixture } from "./sqlite";

test("calendar defaults to hidden and persists independently of ledger and sync records", () => {
  const f = fixture();
  try {
    const before = f.repo.snapshot();
    expect(f.repo.getShowIncomeCalendar()).toBe(false);
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

test("categoryDetailReport supports root tree rollup, child exact drill-down, uncategorized root, over-refunds, and loan repayments", () => {
  const f = fixture();
  try {
    const s = f.repo.snapshot();
    const account = s.accounts[0]!;
    f.repo.saveAccount({ ...account, initialBalance: 100000 });
    const child = s.categories.find((c) => c.kind === "expense" && c.parentId)!;
    const rootId = child.parentId!;
    const incomeCat = s.categories.find((c) => c.kind === "income" && !c.parentId)!;

    f.repo.saveTxn({
      type: "expense",
      amount: 5000,
      accountId: account.id,
      categoryId: child.id,
      occurredAt: "2026-10-08",
      note: "子分类支出",
      forWhom: "both",
    });
    const childExpId = f.repo.snapshot().txns.find((t) => t.note === "子分类支出")!.id;

    // Partial refund reduces net total of child & root tree while staying in rows.
    f.repo.saveTxn({
      type: "refund",
      refundOfId: childExpId,
      amount: 1200,
      accountId: account.id,
      occurredAt: "2026-10-09",
      note: "部分退款",
      forWhom: "both",
    });

    // Expense directly on root ("未细分").
    f.repo.saveTxn({
      type: "expense",
      amount: 2000,
      accountId: account.id,
      categoryId: rootId,
      occurredAt: "2026-10-10",
      note: "一级直记",
      forWhom: "both",
    });

    // Excluded from totals must not appear in detail report.
    f.repo.saveTxn({
      type: "expense",
      amount: 9999,
      accountId: account.id,
      categoryId: child.id,
      occurredAt: "2026-10-11",
      note: "不计收支",
      forWhom: "both",
      excludeTotals: true,
    });

    // Over-refund creating extra income in incomeCat.
    f.repo.saveTxn({
      type: "expense",
      amount: 1000,
      accountId: account.id,
      categoryId: child.id,
      occurredAt: "2026-10-12",
      note: "超退原笔",
      forWhom: "both",
    });
    const overSourceId = f.repo.snapshot().txns.find((t) => t.note === "超退原笔")!.id;
    f.repo.saveTxn({
      type: "refund",
      refundOfId: overSourceId,
      amount: 1300,
      accountId: account.id,
      occurredAt: "2026-10-13",
      note: "超额退款",
      forWhom: "both",
    });

    // Loan repayment included only when includeRepayments = true.
    f.repo.createLoan({
      name: "测试贷款",
      principal: 30000,
      paymentAccountId: account.id,
      monthlyPayment: 3000,
      dueDay: 10,
      totalPeriods: 10,
      paidPeriods: 0,
      interestFreePeriods: 0,
      settlePeriod: 0,
    });
    f.repo.payLoan(f.repo.snapshot().plans[0]!.id, {
      amount: 3000,
      interest: 200,
      date: "2026-10-15",
      categoryId: rootId,
    });

    const snap = f.repo.snapshot();
    const overRefund = snap.txns.find((t) => t.note === "超额退款")!;
    const range = reportRange("month", "2026-10-01", []);

    const rootTree = categoryDetailReport(snap, range, "expense", rootId, "tree");
    // child: 5000 - 1200 + 1000 - 1000 = 3800; direct root: 2000 + interest 200 = 2200 -> 6000
    expect(rootTree.total).toBe(6000);
    expect(rootTree.children.map((c) => c.id).sort()).toEqual([child.id, rootId].sort());
    expect(rootTree.rows.some((r) => r.note === "不计收支")).toBe(false);

    const childExact = categoryDetailReport(snap, range, "expense", child.id, "exact");
    expect(childExact.total).toBe(3800);
    expect(childExact.rows).toHaveLength(4); // 5000 expense, 1200 partial refund, 1000 expense, 1300 over-refund (1000 expense offset)
    expect(childExact.children).toEqual([]);

    const uncategorizedExact = categoryDetailReport(snap, range, "expense", rootId, "exact");
    expect(uncategorizedExact.total).toBe(2200);
    expect(uncategorizedExact.rows.every((r) => r.categoryId === rootId)).toBe(true);

    const incomeDetail = categoryDetailReport(
      snap,
      range,
      "income",
      overRefund.refundIncomeCategoryId ?? incomeCat.id,
      "tree",
    );
    expect(incomeDetail.total).toBe(300);
    expect(incomeDetail.count).toBe(1);

    const withRepayments = reportingSnapshot(snap, "", true, "payer");
    const principalDetail = categoryDetailReport(
      withRepayments,
      range,
      "expense",
      "report-loan-principal",
      "tree",
    );
    expect(principalDetail.total).toBe(2800);
    expect(principalDetail.count).toBe(1);
  } finally {
    f.sqlite.close();
  }
});
