import { fixture } from "./sqlite";
import { accountBalance, totals, visibleTxns } from "../src/domain/selectors";

describe("linked refunds and atomic batch deletion", () => {
  let f: ReturnType<typeof fixture>;
  beforeEach(() => {
    f = fixture();
  });
  afterEach(() => f.sqlite.close());
  const purchase = () => {
    const s = f.repo.snapshot();
    f.repo.saveTxn({
      type: "expense",
      amount: 10000,
      accountId: s.accounts[0]!.id,
      categoryId: s.categories.find((c) => c.kind === "expense")!.id,
      occurredAt: "2026-09-20",
      note: "purchase",
      forWhom: "both",
    });
    return f.repo.snapshot().txns[0]!;
  };
  const refund = (sourceId: string, amount: number) => ({
    type: "refund" as const,
    amount,
    refundOfId: sourceId,
    accountId: f.repo.snapshot().accounts[1]!.id,
    occurredAt: "2026-10-29",
    note: "refund",
    forWhom: "both" as const,
  });
  test("partial refunds return funds to chosen account and offset expense in refund month", () => {
    const source = purchase();
    f.repo.saveTxn(refund(source.id, 3000));
    const s = f.repo.snapshot();
    const row = s.txns.find((t) => t.type === "refund")!;
    expect(row.refundOfId).toBe(source.id);
    expect(row.categoryId).toBe(source.categoryId);
    expect(accountBalance(s.accounts[0]!, s.txns)).toBe(-10000);
    expect(accountBalance(s.accounts[1]!, s.txns)).toBe(3000);
    expect(totals(s.txns)).toEqual({
      expense: 7000,
      income: 0,
      balance: -7000,
    });
    expect(
      totals(s.txns.filter((t) => t.occurredAt.startsWith("2026-10"))).expense,
    ).toBe(-3000);
    expect(f.repo.pendingOperations().at(-1)!.record.id).toBe(row.id);
  });
  test("cumulative limit, refund editing, and deletion reopen the remaining allowance", () => {
    const source = purchase();
    f.repo.saveTxn(refund(source.id, 7000));
    f.repo.saveTxn(refund(source.id, 3000));
    const before = f.repo.snapshot();
    expect(() => f.repo.saveTxn(refund(source.id, 1))).toThrow();
    expect(f.repo.snapshot()).toEqual(before);
    const row = before.txns.find(
      (t) => t.type === "refund" && t.amount === 7000,
    )!;
    f.repo.saveTxn({ ...row, amount: 5000 });
    f.repo.saveTxn(refund(source.id, 2000));
    f.repo.deleteTxn(row.id);
    f.repo.saveTxn(refund(source.id, 5000));
    expect(totals(f.repo.snapshot().txns).expense).toBe(0);
  });
  test("invalid source, dates, amounts, and incompatible edits leave the snapshot unchanged", () => {
    const source = purchase();
    const before = f.repo.snapshot();
    for (const input of [
      refund("missing", 1),
      refund(source.id, 10001),
      refund(source.id, 0),
      refund(source.id, 0.5),
      { ...refund(source.id, 1), occurredAt: "2026-09-19" },
    ])
      expect(() => f.repo.saveTxn(input)).toThrow();
    expect(f.repo.snapshot()).toEqual(before);
    f.repo.saveTxn(refund(source.id, 8000));
    const after = f.repo.snapshot();
    expect(() =>
      f.repo.saveTxn({ ...refund(source.id, 1), id: source.id }),
    ).toThrow();
    expect(() => f.repo.saveTxn({ ...source, amount: 7999 })).toThrow();
    expect(() =>
      f.repo.saveTxn({
        ...source,
        type: "transfer",
        toAccountId: after.accounts[1]!.id,
      }),
    ).toThrow();
    expect(() =>
      f.repo.saveTxn({ ...source, occurredAt: "2026-11-01" }),
    ).toThrow();
    const row = after.txns.find((t) => t.type === "refund")!;
    expect(() => f.repo.saveTxn({ ...row, type: "income" })).toThrow();
    expect(f.repo.snapshot()).toEqual(after);
  });
  test("deleting a purchase requires selecting its refunds, and the batch produces tombstones", () => {
    const source = purchase();
    f.repo.saveTxn(refund(source.id, 4000));
    const before = f.repo.snapshot();
    const row = before.txns.find((t) => t.type === "refund")!;
    expect(() => f.repo.deleteTxn(source.id)).toThrow();
    expect(() => f.repo.deleteTxns([row.id, "missing"])).toThrow();
    expect(f.repo.snapshot()).toEqual(before);
    f.repo.deleteTxns([source.id, row.id, source.id]);
    const after = f.repo.snapshot();
    expect(visibleTxns(after.txns)).toHaveLength(0);
    expect(after.pending - before.pending).toBe(2);
    expect(after.txns.every((t) => t.deleted)).toBe(true);
    expect(after.accounts.map((a) => accountBalance(a, after.txns))).toEqual([
      0, 0, 0,
    ]);
  });
  test("failure writing the second deletion rolls back both records and outbox", () => {
    const source = purchase();
    f.repo.saveTxn(refund(source.id, 1000));
    const before = f.repo.snapshot();
    f.sqlite.exec(
      `CREATE TRIGGER fail_second BEFORE INSERT ON outbox WHEN NEW.op_json LIKE '%"action":"delete"%' AND NEW.op_json LIKE '%"type":"refund"%' BEGIN SELECT RAISE(ABORT, 'disk failure'); END`,
    );
    expect(() => f.repo.deleteTxns(before.txns.map((t) => t.id))).toThrow();
    expect(f.repo.snapshot()).toEqual(before);
  });
});
