import { fixture } from "./sqlite";
import { accountBalance, totals } from "../src/domain/selectors";
test("discarded expense restoration moves linked refunds and preserves balances", () => {
  const f = fixture();
  try {
    const s = f.repo.snapshot(),
      c = s.categories.find((c) => c.kind === "expense" && c.parentId)!,
      target = s.categories.find(
        (c) => c.kind === "expense" && !c.parentId && c.id !== c.parentId,
      )!;
    f.repo.saveTxn({
      type: "expense",
      amount: 10000,
      categoryId: c.id,
      accountId: s.accounts[0]!.id,
      occurredAt: "2026-10-01",
      note: "",
      forWhom: "both",
    });
    const source = f.repo.snapshot().txns[0]!;
    f.repo.saveTxn({
      type: "refund",
      amount: 12000,
      refundOfId: source.id,
      accountId: source.accountId,
      occurredAt: "2026-10-02",
      note: "",
      forWhom: "both",
    });
    f.repo.deleteCategory(c.id, { action: "discard" });
    const before = f.repo.snapshot();
    const refund = before.txns.find((t) => t.type === "refund")!;
    expect(() => f.repo.restoreDiscardedTxn(refund.id, target.id)).toThrow();
    expect(() => f.repo.restoreDiscardedTxn(source.id, c.id)).toThrow();
    f.repo.restoreDiscardedTxn(source.id, target.id);
    const after = f.repo.snapshot();
    expect(
      after.txns.every((t) => !t.discarded && t.categoryId === target.id),
    ).toBe(true);
    expect(accountBalance(after.accounts[0]!, after.txns)).toBe(
      accountBalance(before.accounts[0]!, before.txns),
    );
    expect(totals(after.txns)).toEqual({
      expense: 0,
      income: 2000,
      balance: 2000,
    });
  } finally {
    f.sqlite.close();
  }
});
test("discarded restore rolls back if log write fails", () => {
  const f = fixture();
  try {
    const s = f.repo.snapshot(),
      c = s.categories.find((c) => c.kind === "expense" && c.parentId)!,
      target = s.categories.find((c) => c.kind === "expense" && !c.parentId)!;
    f.repo.saveTxn({
      type: "expense",
      amount: 100,
      categoryId: c.id,
      accountId: s.accounts[0]!.id,
      occurredAt: "2026-10-01",
      note: "",
      forWhom: "me",
    });
    f.repo.deleteCategory(c.id, { action: "discard" });
    const before = f.repo.snapshot();
    f.sqlite.exec(
      "CREATE TRIGGER fail BEFORE INSERT ON outbox BEGIN SELECT RAISE(ABORT,'forced'); END",
    );
    expect(() =>
      f.repo.restoreDiscardedTxn(before.txns[0]!.id, target.id),
    ).toThrow("forced");
    expect(f.repo.snapshot()).toEqual(before);
  } finally {
    f.sqlite.close();
  }
});
