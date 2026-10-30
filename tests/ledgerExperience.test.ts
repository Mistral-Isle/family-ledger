import { randomUUID } from "node:crypto";
import { LedgerRepository } from "../src/db/repository";
import { categoryBudgetUsage, monthDailyMetrics } from "../src/domain/budgets";
import { filterMonthTransactions } from "../src/domain/transactionFilters";
import { reportingSnapshot } from "../src/domain/reports";
import { accountBalance, totals } from "../src/domain/selectors";
import { shiftMonth } from "../src/domain/date";
import { fixture } from "./sqlite";

describe("monthly budget arithmetic", () => {
  test("current month counts today in both elapsed and remaining days", () => {
    expect(monthDailyMetrics("2026-10", 30000, 50000, "2026-10-30")).toEqual({
      elapsed: 30,
      remaining: 2,
      dailyExpense: 1000,
      dailyRemaining: 10000,
    });
    expect(
      monthDailyMetrics("2026-10", 60000, 50000, "2026-10-31").dailyRemaining,
    ).toBe(-10000);
  });
  test("past, future, unset, zero budget, leap month and rounding boundaries", () => {
    expect(monthDailyMetrics("2026-09", 30000, 50000, "2026-10-30")).toEqual({
      elapsed: 30,
      remaining: 0,
      dailyExpense: 1000,
      dailyRemaining: null,
    });
    expect(monthDailyMetrics("2026-11", 0, 30000, "2026-10-30")).toEqual({
      elapsed: 0,
      remaining: 30,
      dailyExpense: null,
      dailyRemaining: 1000,
    });
    expect(
      monthDailyMetrics("2026-10", 0, null, "2026-10-30").dailyRemaining,
    ).toBeNull();
    expect(
      monthDailyMetrics("2026-10", 1, 0, "2026-10-30").dailyRemaining,
    ).toBe(-1);
    expect(
      monthDailyMetrics("2028-02", 2900, 3000, "2028-03-01").dailyExpense,
    ).toBe(100);
    expect(
      monthDailyMetrics("2028-02", 0, 2900, "2028-02-01").dailyRemaining,
    ).toBe(100);
    expect(shiftMonth("2026-12", 1)).toBe("2027-01");
    expect(shiftMonth("2026-01", -1)).toBe("2025-12");
  });
});

describe("reporting preferences and actual ledger stay separate", () => {
  let f: ReturnType<typeof fixture>;
  beforeEach(() => {
    f = fixture();
  });
  afterEach(() => f.sqlite.close());
  test("preference persists after reopening without changing data or sync operations", () => {
    const before = f.repo.snapshot();
    expect(f.repo.getIncludeRepayments()).toBe(false);
    f.repo.setIncludeRepayments(true);
    const reopened = new LedgerRepository(f.driver, randomUUID);
    reopened.initialize();
    expect(reopened.getIncludeRepayments()).toBe(true);
    expect(reopened.snapshot()).toEqual(before);
    reopened.setIncludeRepayments(false);
    expect(
      new LedgerRepository(f.driver, randomUUID).getIncludeRepayments(),
    ).toBe(false);
  });
  test("principal lowers cash and debt equally; only interest lowers net assets; transfers never count", () => {
    const initial = f.repo.snapshot();
    const bank = initial.accounts[0]!;
    const target = initial.accounts[1]!;
    f.repo.saveAccount({ ...bank, initialBalance: 200000 });
    const category = initial.categories.find(
      (c) => c.kind === "expense" && c.parentId,
    )!;
    f.repo.createLoan({
      name: "验收贷款",
      principal: 100000,
      paymentAccountId: bank.id,
      monthlyPayment: 10000,
      dueDay: 15,
      totalPeriods: 12,
      paidPeriods: 0,
      interestFreePeriods: 0,
      settlePeriod: 0,
    });
    const before = f.repo.snapshot();
    const net = (s: typeof before) =>
      s.accounts
        .filter((a) => !a.deleted && a.scope === "family")
        .reduce((n, a) => n + accountBalance(a, s.txns), 0);
    f.repo.payLoan(before.plans[0]!.id, {
      amount: 10000,
      interest: 1000,
      date: "2026-10-30",
      categoryId: category.id,
    });
    const after = f.repo.snapshot();
    const debt = after.accounts.find((a) => a.kind === "loan")!;
    expect(
      accountBalance(
        after.accounts.find((a) => a.id === bank.id)!,
        after.txns,
      ),
    ).toBe(190000);
    expect(accountBalance(debt, after.txns)).toBe(-91000);
    expect(net(after)).toBe(net(before) - 1000);
    expect(totals(reportingSnapshot(after, "", false).txns).expense).toBe(1000);
    expect(totals(reportingSnapshot(after, "", true).txns).expense).toBe(10000);
    expect(
      categoryBudgetUsage(after.txns, after.categories, "2026-10").get(
        category.parentId!,
      ),
    ).toBe(1000);
    f.repo.saveTxn({
      type: "transfer",
      amount: 50000,
      accountId: bank.id,
      toAccountId: target.id,
      occurredAt: "2026-10-30",
      note: "本人转账",
      forWhom: "me",
    });
    const transferred = f.repo.snapshot();
    expect(net(transferred)).toBe(net(after));
    expect(
      accountBalance(
        transferred.accounts.find((a) => a.id === bank.id)!,
        transferred.txns,
      ),
    ).toBe(140000);
    expect(
      accountBalance(
        transferred.accounts.find((a) => a.id === target.id)!,
        transferred.txns,
      ),
    ).toBe(target.initialBalance + 50000);
    expect(totals(reportingSnapshot(transferred, "", true).txns).expense).toBe(
      10000,
    );
    expect(f.repo.snapshot()).toEqual(transferred);
  });
  test("multi-select ORs types, ANDs category search and excludes other months; refunds offset parent budgets", () => {
    const s = f.repo.snapshot();
    const category = s.categories.find(
      (c) => c.kind === "expense" && c.parentId,
    )!;
    const root = s.categories.find((c) => c.id === category.parentId)!;
    const common = {
      accountId: s.accounts[0]!.id,
      occurredAt: "2026-10-01",
      note: "验收",
      forWhom: "both" as const,
    };
    f.repo.saveTxn({
      ...common,
      type: "expense",
      categoryId: category.id,
      amount: 10000,
    });
    const original = f.repo.snapshot().txns[0]!;
    f.repo.saveTxn({
      ...common,
      type: "refund",
      refundOfId: original.id,
      amount: 3000,
    });
    f.repo.saveTxn({
      ...common,
      type: "income",
      categoryId: s.categories.find((c) => c.kind === "income")!.id,
      amount: 50000,
    });
    f.repo.saveTxn({
      ...common,
      type: "expense",
      categoryId: category.id,
      amount: 500,
      occurredAt: "2026-11-01",
    });
    const next = f.repo.snapshot();
    expect(
      filterMonthTransactions(
        next,
        "2026-10",
        ["expense", "refund"],
        root.name,
      ),
    ).toHaveLength(2);
    expect(
      filterMonthTransactions(next, "2026-10", ["income"], root.name),
    ).toHaveLength(0);
    expect(filterMonthTransactions(next, "2026-10", [], "")).toHaveLength(3);
    const usage = categoryBudgetUsage(next.txns, next.categories, "2026-10");
    expect(usage.get(root.id)).toBe(7000);
    expect(usage.get(category.id)).toBe(7000);
    const discarded = {
      ...next,
      txns: next.txns.map((t) => ({ ...t, discarded: true })),
    };
    expect(filterMonthTransactions(discarded, "2026-10", [], "")).toEqual([]);
    expect(
      categoryBudgetUsage(discarded.txns, next.categories, "2026-10").size,
    ).toBe(0);
  });
});
