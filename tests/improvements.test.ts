import { fixture } from "./sqlite";
import { accountBalance, totals, budgetTxns } from "../src/domain/selectors";
import { splitPrepayment } from "../src/domain/finance";
import { calculate } from "../src/domain/money";
import {
  privacyAccountId,
  transferDirection,
} from "../src/domain/privacyTransfer";
import { exportSheets } from "../src/domain/export";
import { categoryBudgetUsage } from "../src/domain/budgets";

function pair() {
  const a = fixture(),
    b = fixture();
  b.repo.prepareJoin("对方");
  b.repo.mergeOperations(a.repo.pendingOperations());
  a.repo.mergeOperations(b.repo.pendingOperations());
  return { a, b };
}
function privateAccount(
  f: ReturnType<typeof fixture>,
  name = "SECRET_BANK",
  initialBalance = 123456,
) {
  f.repo.saveAccount({
    name,
    kind: "bank",
    scope: "private",
    initialBalance,
    last4: "9381",
  });
  return f.repo.snapshot().accounts.find((a) => a.name === name)!;
}
test.each([
  ["2027-01", ["2027-01-31", "2027-02-28", "2027-03-31", "2027-04-30"]],
  ["2028-01", ["2028-01-31", "2028-02-29", "2028-03-31", "2028-04-30"]],
])("monthly dates retain day 31 across %s", (month, expected) => {
  expect(
    splitPrepayment(40000, 4, month as string, 31).map((p) => p.date),
  ).toEqual(expected);
});
test.each([28, 29, 30, 31])("400 / 3 conserves cents for day %i", (day) => {
  const p = splitPrepayment(calculate("400"), 3, "2028-02", day);
  expect(p.map((x) => x.amount)).toEqual([13333, 13333, 13334]);
  expect(p.reduce((n, x) => n + x.amount, 0)).toBe(40000);
  expect(p[1]!.date).toBe(`2028-03-${day}`);
});
test("400 prepayment creates one funding transfer and 400 total expense; editing does not double", () => {
  const f = fixture();
  try {
    const s = f.repo.snapshot(),
      a = s.accounts[0]!,
      c = s.categories.find((c) => c.kind === "expense" && c.parentId)!;
    const input = {
      name: "三个月",
      amount: 40000,
      paymentAccountId: a.id,
      categoryId: c.id,
      date: "2028-01-01",
      startMonth: "2028-01",
      months: 3,
      day: 31,
    };
    f.repo.savePrepayment(input);
    f.repo.savePrepayment({ ...input, id: f.repo.snapshot().plans[0]!.id });
    expect(totals(f.repo.snapshot().txns).expense).toBe(40000);
    expect(accountBalance(a, f.repo.snapshot().txns)).toBe(
      a.initialBalance - 40000,
    );
  } finally {
    f.sqlite.close();
  }
});
test.each([
  [true, false],
  [false, true],
  [true, true],
  [false, false],
])(
  "budget %s and cashflow %s exclusions remain independent with refunds and backup",
  (excludeBudget, excludeTotals) => {
    const f = fixture(),
      other = fixture();
    try {
      const s = f.repo.snapshot(),
        a = s.accounts[0]!,
        c = s.categories.find((c) => c.kind === "expense" && c.parentId)!;
      const input = {
        type: "expense" as const,
        amount: 10000,
        accountId: a.id,
        categoryId: c.id,
        occurredAt: "2026-10-01",
        note: "",
        forWhom: "both" as const,
        excludeBudget,
        excludeTotals,
      };
      const id = f.repo.saveTxn(input);
      f.repo.saveTxn({
        type: "refund",
        amount: 2000,
        accountId: a.id,
        refundOfId: id,
        occurredAt: "2026-10-02",
        note: "",
        forWhom: "both",
      });
      let rows = f.repo.snapshot().txns;
      expect(accountBalance(a, rows)).toBe(a.initialBalance - 8000);
      expect(totals(rows).expense).toBe(excludeTotals ? 0 : 8000);
      expect(totals(budgetTxns(rows)).expense).toBe(excludeBudget ? 0 : 8000);
      expect(
        categoryBudgetUsage(rows, s.categories, "2026-10").get(c.id) ?? 0,
      ).toBe(excludeBudget ? 0 : 8000);
      other.repo.restoreBackup(f.repo.exportBackup());
      expect(totals(other.repo.snapshot().txns)).toEqual(totals(rows));
      f.repo.saveTxn({
        ...input,
        id,
        excludeBudget: !excludeBudget,
        excludeTotals: !excludeTotals,
      });
      rows = f.repo.snapshot().txns;
      expect(totals(rows).expense).toBe(!excludeTotals ? 0 : 8000);
    } finally {
      f.sqlite.close();
      other.sqlite.close();
    }
  },
);
test("two-device private receipt is pending then applied exactly once, edits/deletes converge and details never sync/export", () => {
  const { a, b } = pair();
  try {
    const secret = privateAccount(b),
      s = a.repo.snapshot(),
      source = s.accounts[0]!;
    const input = {
      accountId: source.id,
      toAccountId: privacyAccountId(b.repo.snapshot().meId),
      amount: 2500,
      occurredAt: "2026-10-31",
      note: "SECRET_NOTE",
    };
    const id = a.repo.saveMemberTransfer(input);
    b.repo.mergeOperations(a.repo.pendingOperations());
    expect(b.repo.pendingPrivateTransfers()).toHaveLength(1);
    b.repo.setPrivateReceiptAccount(secret.id);
    b.repo.mergeOperations(a.repo.pendingOperations());
    expect(accountBalance(secret, b.repo.snapshot().txns)).toBe(
      secret.initialBalance + 2500,
    );
    expect(
      b.repo.snapshot().txns.filter((t) => t.scope === "private"),
    ).toHaveLength(1);
    expect(
      transferDirection(
        b.repo.snapshot(),
        b.repo.snapshot().txns.find((t) => t.id === id)!,
      ),
    ).toBe("转入");
    const other = privateAccount(b, "OTHER_SECRET", 0);
    b.repo.setPrivateReceiptAccount(other.id);
    a.repo.saveMemberTransfer({ ...input, id, amount: 3000 });
    b.repo.mergeOperations(a.repo.pendingOperations());
    expect(accountBalance(secret, b.repo.snapshot().txns)).toBe(
      secret.initialBalance + 3000,
    );
    expect(accountBalance(other, b.repo.snapshot().txns)).toBe(0);
    const publicData = JSON.stringify([
      ...a.repo.pendingOperations(),
      ...b.repo.pendingOperations(),
      ...exportSheets(b.repo.snapshot(), {
        start: "2026-10-01",
        end: "2026-10-31",
      }),
    ]);
    for (const value of [
      secret.id,
      secret.name,
      "SECRET_NOTE",
      "9381",
      "123456",
      other.id,
    ])
      expect(publicData).not.toContain(value);
    expect(totals(b.repo.snapshot().txns)).toEqual({
      expense: 0,
      income: 0,
      balance: 0,
    });
    const backup = b.repo.exportBackup();
    b.repo.restoreBackup(backup);
    expect(accountBalance(secret, b.repo.snapshot().txns)).toBe(
      secret.initialBalance + 3000,
    );
    a.repo.deleteTxn(id);
    b.repo.mergeOperations(a.repo.pendingOperations());
    b.repo.mergeOperations(a.repo.pendingOperations());
    expect(accountBalance(secret, b.repo.snapshot().txns)).toBe(
      secret.initialBalance,
    );
    expect(accountBalance(source, a.repo.snapshot().txns)).toBe(
      source.initialBalance,
    );
  } finally {
    a.sqlite.close();
    b.sqlite.close();
  }
});
test("private sender to private receiver preserves balances and publishes only aliases", () => {
  const { a, b } = pair();
  try {
    const from = privateAccount(a, "SECRET_FROM"),
      to = privateAccount(b, "SECRET_TO");
    b.repo.setPrivateReceiptAccount(to.id);
    const input = {
      accountId: from.id,
      toAccountId: privacyAccountId(b.repo.snapshot().meId),
      amount: 5000,
      occurredAt: "2026-10-31",
      note: "SECRET",
    };
    const id = a.repo.saveMemberTransfer(input);
    b.repo.mergeOperations(a.repo.pendingOperations());
    expect(accountBalance(from, a.repo.snapshot().txns)).toBe(
      from.initialBalance - 5000,
    );
    expect(accountBalance(to, b.repo.snapshot().txns)).toBe(
      to.initialBalance + 5000,
    );
    expect(JSON.stringify(a.repo.pendingOperations())).not.toContain(from.id);
    expect(() =>
      a.repo.saveMemberTransfer({
        ...input,
        accountId: privacyAccountId(b.repo.snapshot().meId),
      }),
    ).toThrow();
    a.repo.deleteTxn(id);
    b.repo.mergeOperations(a.repo.pendingOperations());
    expect(accountBalance(from, a.repo.snapshot().txns)).toBe(
      from.initialBalance,
    );
    expect(accountBalance(to, b.repo.snapshot().txns)).toBe(to.initialBalance);
  } finally {
    a.sqlite.close();
    b.sqlite.close();
  }
});

test("archived default blocks private debit and edited financial funding stays managed", () => {
  const f = fixture();
  try {
    const secret = privateAccount(f),
      s = f.repo.snapshot();
    f.repo.setPrivateReceiptAccount(secret.id);
    f.repo.saveAccount({ ...secret, archived: true });
    expect(() =>
      f.repo.saveMemberTransfer({
        accountId: privacyAccountId(s.meId),
        toAccountId: s.accounts[0]!.id,
        amount: 100,
        occurredAt: "2026-10-31",
        note: "",
      }),
    ).toThrow();
    f.repo.savePrepayment({
      name: "分摊",
      amount: 40000,
      paymentAccountId: s.accounts[0]!.id,
      categoryId: s.categories.find((c) => c.kind === "expense")!.id,
      date: "2026-10-01",
      startMonth: "2026-10",
      months: 3,
      day: 31,
    });
    const plan = f.repo.snapshot().plans[0]!,
      funding = f.repo
        .snapshot()
        .txns.find((t) => t.id === JSON.parse(plan.data).txnIds[0])!;
    expect(() =>
      f.repo.saveMemberTransfer({
        ...funding,
        toAccountId: funding.toAccountId!,
        amount: 80000,
      }),
    ).toThrow();
  } finally {
    f.sqlite.close();
  }
});
test("unconfigured receipt deleted before configuration never credits; incoming batch order is idempotent", () => {
  const { a, b } = pair();
  try {
    const to = privateAccount(b),
      source = a.repo.snapshot().accounts[0]!;
    const id = a.repo.saveMemberTransfer({
      accountId: source.id,
      toAccountId: privacyAccountId(b.repo.snapshot().meId),
      amount: 2000,
      occurredAt: "2026-10-31",
      note: "",
    });
    a.repo.deleteTxn(id);
    b.repo.mergeOperations([...a.repo.pendingOperations()].reverse());
    b.repo.setPrivateReceiptAccount(to.id);
    expect(b.repo.pendingPrivateTransfers()).toHaveLength(0);
    expect(accountBalance(to, b.repo.snapshot().txns)).toBe(to.initialBalance);
  } finally {
    a.sqlite.close();
    b.sqlite.close();
  }
});

test("changing a private receipt to an expense reverses the private balance and remains restorable", () => {
  const { a, b } = pair();
  try {
    const secret = privateAccount(b),
      s = a.repo.snapshot();
    b.repo.setPrivateReceiptAccount(secret.id);
    const id = a.repo.saveMemberTransfer({
      accountId: s.accounts[0]!.id,
      toAccountId: privacyAccountId(b.repo.snapshot().meId),
      amount: 2000,
      occurredAt: "2026-10-31",
      note: "",
    });
    b.repo.mergeOperations(a.repo.pendingOperations());
    expect(accountBalance(secret, b.repo.snapshot().txns)).toBe(
      secret.initialBalance + 2000,
    );
    a.repo.saveTxn({
      id,
      type: "expense",
      amount: 2000,
      accountId: s.accounts[0]!.id,
      categoryId: s.categories.find((c) => c.kind === "expense" && c.parentId)!
        .id,
      occurredAt: "2026-10-31",
      note: "",
      forWhom: "both",
    });
    b.repo.mergeOperations(a.repo.pendingOperations());
    b.repo.mergeOperations(a.repo.pendingOperations());
    expect(accountBalance(secret, b.repo.snapshot().txns)).toBe(
      secret.initialBalance,
    );
    expect(totals(b.repo.snapshot().txns).expense).toBe(2000);
    b.repo.restoreBackup(b.repo.exportBackup());
    expect(accountBalance(secret, b.repo.snapshot().txns)).toBe(
      secret.initialBalance,
    );
  } finally {
    a.sqlite.close();
    b.sqlite.close();
  }
});

test("v5 backup with category undo history restores missing exclusion defaults", () => {
  const f = fixture(),
    other = fixture();
  try {
    const s = f.repo.snapshot(),
      c = s.categories.find((c) => c.kind === "expense" && c.parentId)!;
    const id = f.repo.saveTxn({
      type: "expense",
      amount: 1234,
      accountId: s.accounts[0]!.id,
      categoryId: c.id,
      occurredAt: "2026-10-31",
      note: "",
      forWhom: "both",
    });
    f.repo.deleteCategory(c.id, { action: "discard" });
    const raw = JSON.parse(f.repo.exportBackup());
    raw.version = 5;
    for (const row of raw.tables.txn) {
      delete row.exclude_budget;
      delete row.exclude_totals;
    }
    for (const pref of raw.tables.local_pref) {
      if (pref.key !== "categoryDeletionHistory") continue;
      const history = JSON.parse(pref.value);
      for (const h of history)
        for (const txn of h.txns) {
          delete txn.excludeBudget;
          delete txn.excludeTotals;
        }
      pref.value = JSON.stringify(history);
    }
    for (const row of raw.tables.outbox) {
      const op = JSON.parse(row.op_json);
      if (op.entity === "txn") {
        delete op.record.excludeBudget;
        delete op.record.excludeTotals;
        row.op_json = JSON.stringify(op);
      }
    }
    other.repo.restoreBackup(JSON.stringify(raw));
    other.repo.restoreCategoryDeletion(
      other.repo.categoryDeletionHistory()[0]!.id,
    );
    const txn = other.repo.snapshot().txns.find((t) => t.id === id)!;
    expect(txn).toMatchObject({
      discarded: false,
      excludeBudget: false,
      excludeTotals: false,
    });
    expect(totals(other.repo.snapshot().txns).expense).toBe(1234);
    expect(
      accountBalance(
        other.repo.snapshot().accounts.find((a) => a.id === s.accounts[0]!.id)!,
        other.repo.snapshot().txns,
      ),
    ).toBe(s.accounts[0]!.initialBalance - 1234);
  } finally {
    f.sqlite.close();
    other.sqlite.close();
  }
});
