import { randomUUID } from "node:crypto";
import { fixture } from "./sqlite";
import { LedgerRepository } from "../src/db/repository";
import { accountBalance, totals } from "../src/domain/selectors";
import {
  filterMonthTransactions,
  isFutureTransaction,
} from "../src/domain/transactionFilters";

test("future filter uses Shanghai date/time, includes undated time today, and never alters the ledger", () => {
  const f = fixture();
  try {
    const s = f.repo.snapshot(),
      account = s.accounts.find((a) => a.scope === "family")!,
      category = s.categories.find((c) => c.kind === "expense" && !c.parentId)!;
    for (const [date, time] of [
      ["2026-10-31", "23:59"],
      ["2026-11-01", null],
      ["2026-11-01", "10:29"],
      ["2026-11-01", "10:30"],
      ["2026-11-01", "10:31"],
      ["2026-11-02", null],
    ]) {
      f.repo.saveTxn({
        type: "expense",
        amount: 100,
        accountId: account.id,
        categoryId: category.id,
        occurredAt: date!,
        occurredTime: time,
        note: "",
        forWhom: "both",
      });
    }
    const data = f.repo.snapshot(),
      now = new Date("2026-11-01T02:30:00Z");
    expect(filterMonthTransactions(data, "2026-11", [], "", now)).toHaveLength(
      3,
    );
    expect(filterMonthTransactions(data, "2026-11", [], "")).toHaveLength(5);
    expect(
      filterMonthTransactions(
        data,
        "2026-11",
        [],
        "",
        new Date("2026-11-01T02:31:00Z"),
      ),
    ).toHaveLength(4);
    expect(
      isFutureTransaction(
        { occurredAt: "2026-11-01", occurredTime: null },
        new Date("2026-10-31T15:59:00Z"),
      ),
    ).toBe(true);
    expect(f.repo.snapshot()).toEqual(data);
  } finally {
    f.sqlite.close();
  }
});

test("income and expense entry modes and future filter persist independently without sync operations", () => {
  const f = fixture();
  try {
    const before = f.repo.snapshot();
    f.repo.setEntryMode("expense", "daily");
    f.repo.setHideFutureTransactions(true);
    const repo = new LedgerRepository(f.driver, randomUUID);
    expect(repo.getEntryModes()).toEqual({
      expense: "daily",
      income: "standard",
    });
    repo.setEntryMode("income", "daily");
    repo.setEntryMode("expense", "standard");
    expect(repo.getEntryModes()).toEqual({
      expense: "standard",
      income: "daily",
    });
    expect(repo.getHideFutureTransactions()).toBe(true);
    expect(repo.snapshot()).toEqual(before);
  } finally {
    f.sqlite.close();
  }
});

test("balance corrections optionally become categorized income or expense, with signed balance and positive cashflow amounts", () => {
  const f = fixture(),
    peer = fixture();
  try {
    const s = f.repo.snapshot(),
      a = s.accounts.find((a) => a.scope === "family")!;
    const income = s.categories.find(
        (c) => c.kind === "income" && !c.parentId,
      )!,
      expense = s.categories.find((c) => c.kind === "expense" && !c.parentId)!;
    f.repo.adjustAccountBalance(a.id, 20000, "2026-11-01", {
      countAsCashflow: true,
      categoryId: income.id,
    });
    f.repo.adjustAccountBalance(a.id, 12000, "2026-11-02", {
      countAsCashflow: true,
      categoryId: expense.id,
    });
    f.repo.adjustAccountBalance(a.id, 11000, "2026-11-03");
    const after = f.repo.snapshot();
    expect(accountBalance(a, after.txns)).toBe(11000);
    expect(totals(after.txns)).toEqual({
      income: 20000,
      expense: 8000,
      balance: 12000,
    });
    expect(after.txns.find((t) => t.type === "adjust")?.amount).toBe(-1000);
    expect(after.txns.find((t) => t.type === "expense")?.categoryId).toBe(
      expense.id,
    );
    expect(after.txns.find((t) => t.type === "expense")?.amount).toBe(8000);
    expect(() =>
      f.repo.adjustAccountBalance(a.id, 5000, "2026-11-03", {
        countAsCashflow: true,
        categoryId: income.id,
      }),
    ).toThrow();
    expect(() =>
      f.repo.adjustAccountBalance(a.id, 5000, "2026-11-03", {
        countAsCashflow: true,
      }),
    ).toThrow();
    expect(f.repo.snapshot()).toEqual(after);
    peer.repo.prepareJoin("对方");
    peer.repo.mergeOperations(f.repo.pendingOperations());
    expect(totals(peer.repo.snapshot().txns)).toEqual(totals(after.txns));
    expect(accountBalance(a, peer.repo.snapshot().txns)).toBe(11000);
  } finally {
    f.sqlite.close();
    peer.sqlite.close();
  }
});
