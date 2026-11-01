import { fixture } from "./sqlite";
import { accountHistory } from "../src/domain/accountDetails";
import { accountBalance, totals } from "../src/domain/selectors";

function setup() {
  const f = fixture(),
    s = f.repo.snapshot();
  const [a, b] = s.accounts.filter((a) => a.scope === "family");
  const category = s.categories.find(
    (c) => c.kind === "expense" && c.parentId,
  )!;
  const expense = f.repo.saveTxn({
    type: "expense",
    accountId: a!.id,
    categoryId: category.id,
    amount: 10000,
    occurredAt: "2026-11-01",
    note: "测试",
    forWhom: "both",
  });
  const transfer = f.repo.saveTxn({
    type: "transfer",
    accountId: a!.id,
    toAccountId: b!.id,
    amount: 2000,
    occurredAt: "2026-11-02",
    note: "",
    forWhom: "both",
  });
  const refund = f.repo.saveTxn({
    type: "refund",
    refundOfId: expense,
    accountId: b!.id,
    amount: 3000,
    occurredAt: "2026-11-03",
    note: "",
    forWhom: "both",
  });
  return { ...f, a: a!, b: b!, expense, transfer, refund };
}

test("deleting an account while retaining transactions preserves statistics, counterparty balance and backup restore", () => {
  const f = setup(),
    peer = fixture();
  try {
    peer.repo.prepareJoin("另一位");
    peer.repo.mergeOperations(f.repo.pendingOperations());
    const before = f.repo.snapshot();
    f.repo.deleteAccount(f.a.id, false);
    const after = f.repo.snapshot();
    expect(after.accounts.find((a) => a.id === f.a.id)?.deleted).toBe(true);
    expect(after.txns).toEqual(before.txns);
    expect(totals(after.txns)).toEqual(totals(before.txns));
    expect(accountBalance(f.b, after.txns)).toBe(5000);
    peer.repo.mergeOperations(f.repo.pendingOperations());
    expect(
      peer.repo.snapshot().accounts.find((a) => a.id === f.a.id)?.deleted,
    ).toBe(true);
    expect(totals(peer.repo.snapshot().txns)).toEqual(totals(before.txns));
    f.repo.restoreBackup(f.repo.exportBackup());
    expect(f.repo.snapshot().txns).toEqual(before.txns);
  } finally {
    f.sqlite.close();
    peer.sqlite.close();
  }
});

test("deleting an account and its records includes cross-account refunds and transfers, converges and remains restorable", () => {
  const f = setup(),
    peer = fixture();
  try {
    peer.repo.prepareJoin("另一位");
    peer.repo.mergeOperations(f.repo.pendingOperations());
    f.repo.deleteAccount(f.a.id, true);
    const after = f.repo.snapshot();
    expect(after.txns.filter((t) => !t.deleted)).toHaveLength(0);
    expect(accountBalance(f.b, after.txns)).toBe(0);
    expect(totals(after.txns)).toEqual({ income: 0, expense: 0, balance: 0 });
    peer.repo.mergeOperations(f.repo.pendingOperations());
    peer.repo.mergeOperations(f.repo.pendingOperations());
    expect(accountBalance(f.b, peer.repo.snapshot().txns)).toBe(0);
    f.repo.restoreBackup(f.repo.exportBackup());
    expect(
      f.repo.snapshot().accounts.find((a) => a.id === f.a.id)?.deleted,
    ).toBe(true);
  } finally {
    f.sqlite.close();
    peer.sqlite.close();
  }
});

test("deletion failure rolls back account, transactions and preference cleanup together", () => {
  const f = setup();
  try {
    const before = JSON.parse(f.repo.exportBackup()).tables;
    f.sqlite.exec(
      `CREATE TRIGGER fail_account BEFORE INSERT ON outbox WHEN NEW.op_json LIKE '%"entity":"account"%' BEGIN SELECT RAISE(ABORT, 'forced'); END`,
    );
    expect(() => f.repo.deleteAccount(f.a.id, true)).toThrow("forced");
    expect(JSON.parse(f.repo.exportBackup()).tables).toEqual(before);
  } finally {
    f.sqlite.close();
  }
});

test("balance correction uses dated adjustment, keeps initial balance and spending unchanged, and a repeated target is a no-op", () => {
  const f = setup();
  try {
    const before = f.repo.snapshot();
    f.repo.adjustAccountBalance(f.a.id, -500, "2026-11-02");
    const after = f.repo.snapshot();
    expect(after.accounts.find((a) => a.id === f.a.id)?.initialBalance).toBe(
      f.a.initialBalance,
    );
    expect(accountBalance(f.a, after.txns, "2026-11-01")).toBe(-10000);
    expect(accountBalance(f.a, after.txns, "2026-11-02")).toBe(-500);
    expect(totals(after.txns)).toEqual(totals(before.txns));
    f.repo.adjustAccountBalance(f.a.id, -500, "2026-11-02");
    expect(f.repo.snapshot()).toEqual(after);
    const report = accountHistory(after, f.a, "2026-11");
    expect(report.rows[0]!.balance).toBe(-500);
    expect(report.inflow).toBe(11500);
    expect(report.outflow).toBe(12000);
  } finally {
    f.sqlite.close();
  }
});

test("account detail includes incoming transfer/refund and outgoing transfer with correct running balances", () => {
  const f = setup();
  try {
    const report = accountHistory(f.repo.snapshot(), f.b, "2026-11");
    expect(report.inflow).toBe(5000);
    expect(report.outflow).toBe(0);
    expect(report.rows.map((r) => r.balance)).toEqual([5000, 2000]);
  } finally {
    f.sqlite.close();
  }
});

test("account ordering applies to the visible subset, synchronizes and does not change balances", () => {
  const f = setup(),
    peer = fixture();
  try {
    peer.repo.prepareJoin("另一位");
    const before = f.repo.snapshot();
    f.repo.reorderAccounts([f.b.id, f.a.id]);
    peer.repo.mergeOperations(f.repo.pendingOperations());
    for (const repo of [f.repo, peer.repo]) {
      expect(
        repo
          .snapshot()
          .accounts.filter((a) => !a.deleted && a.ownerMemberId === before.meId)
          .sort((a, b) => a.sort - b.sort)
          .slice(0, 2)
          .map((a) => a.id),
      ).toEqual([f.b.id, f.a.id]);
      expect(accountBalance(f.a, repo.snapshot().txns)).toBe(
        accountBalance(f.a, before.txns),
      );
    }
    const after = f.repo.snapshot();
    expect(() => f.repo.reorderAccounts([f.a.id, f.a.id])).toThrow();
    expect(f.repo.snapshot()).toEqual(after);
  } finally {
    f.sqlite.close();
    peer.sqlite.close();
  }
});

test("managed plan accounts cannot be silently orphaned by deleting their payment account", () => {
  const f = setup();
  try {
    const categoryId = f.repo
      .snapshot()
      .categories.find((c) => c.kind === "expense" && c.parentId)!.id;
    f.repo.savePrepayment({
      name: "年费",
      paymentAccountId: f.a.id,
      categoryId,
      amount: 12000,
      date: "2026-11-01",
      startMonth: "2026-11",
      months: 12,
      day: 1,
    });
    const before = f.repo.snapshot();
    expect(() => f.repo.deleteAccount(f.a.id, true)).toThrow("计划");
    expect(f.repo.snapshot()).toEqual(before);
  } finally {
    f.sqlite.close();
  }
});
