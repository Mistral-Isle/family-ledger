import { fixture } from "./sqlite";
import { accountBalance, totals } from "../src/domain/selectors";
import { exportSheets } from "../src/domain/export";
import { reportRange } from "../src/domain/reports";
describe("private ledger isolation and transfer shells", () => {
  let f: ReturnType<typeof fixture>;
  beforeEach(() => {
    f = fixture();
  });
  afterEach(() => f.sqlite.close());
  function account() {
    f.repo.saveAccount({
      name: "PRIVATE_ACCOUNT",
      kind: "cash",
      initialBalance: 10000,
      scope: "private",
    });
    return f.repo.snapshot().accounts.find((a) => a.scope === "private")!;
  }
  test("private account, purchases, refunds, edits and deletion never enter family outbox or preferences", () => {
    const before = f.repo.snapshot(),
      a = account(),
      c = before.categories.find((c) => c.kind === "expense")!;
    f.repo.saveTxn({
      type: "expense",
      amount: 100,
      categoryId: c.id,
      accountId: a.id,
      occurredAt: "2026-10-01",
      note: "PRIVATE_NOTE",
      forWhom: "me",
    });
    const source = f.repo.snapshot().txns[0]!;
    f.repo.saveTxn({
      type: "refund",
      amount: 200,
      refundOfId: source.id,
      accountId: a.id,
      occurredAt: "2026-10-02",
      note: "PRIVATE_REFUND",
      forWhom: "me",
    });
    const s = f.repo.snapshot();
    expect(s.pending).toBe(before.pending);
    expect(s.preferences).toEqual(before.preferences);
    expect(totals(s.txns)).toEqual({ expense: 0, income: 0, balance: 0 });
    expect(
      JSON.stringify(exportSheets(s, reportRange("month", "2026-10-01", []))),
    ).not.toContain("PRIVATE_");
    expect(() =>
      f.repo.saveFavorite({
        categoryId: c.id,
        accountId: a.id,
        label: "private",
        note: "",
      }),
    ).toThrow();
    f.repo.deleteTxns(s.txns.map((t) => t.id));
    expect(f.repo.snapshot().pending).toBe(before.pending);
  });
  test.each([true, false])(
    "cross-scope transfer direction %s writes one public shell and conserves balance",
    (outgoing) => {
      const a = account(),
        s = f.repo.snapshot(),
        family = s.accounts.find((a) => a.scope === "family")!;
      const pending = f.repo.pendingOperations().length;
      f.repo.transferScopes({
        fromId: outgoing ? family.id : a.id,
        toId: outgoing ? a.id : family.id,
        amount: 2500,
        occurredAt: "2026-10-01",
        note: "PRIVATE_NOTE",
      });
      const after = f.repo.snapshot(),
        ops = f.repo.pendingOperations().slice(pending);
      expect(ops).toHaveLength(1);
      expect(JSON.stringify(ops)).not.toContain(a.id);
      expect(JSON.stringify(ops)).not.toContain("PRIVATE_");
      expect(accountBalance(a, after.txns)).toBe(outgoing ? 12500 : 7500);
      expect(accountBalance(family, after.txns)).toBe(outgoing ? -2500 : 2500);
      expect(totals(after.txns).balance).toBe(0);
      expect(() =>
        f.repo.deleteTxn(after.txns.find((t) => t.scope === "private")!.id),
      ).toThrow();
      const other = fixture();
      try {
        other.repo.restoreBackup(f.repo.exportBackup());
        expect(other.repo.scopeTransfers()).toEqual(f.repo.scopeTransfers());
      } finally {
        other.sqlite.close();
      }
      f.repo.deleteScopeTransfer(f.repo.scopeTransfers()[0]!.id);
      expect(accountBalance(a, f.repo.snapshot().txns)).toBe(10000);
      expect(accountBalance(family, f.repo.snapshot().txns)).toBe(0);
    },
  );
  test("failed transfer writes neither side and no local pairing", () => {
    const a = account(),
      s = f.repo.snapshot();
    f.sqlite.exec(
      "CREATE TRIGGER fail BEFORE INSERT ON outbox BEGIN SELECT RAISE(ABORT,'forced'); END",
    );
    expect(() =>
      f.repo.transferScopes({
        fromId: a.id,
        toId: s.accounts[0]!.id,
        amount: 100,
        occurredAt: "2026-10-01",
        note: "",
      }),
    ).toThrow("forced");
    expect(f.repo.snapshot()).toEqual(s);
    expect(f.repo.scopeTransfers()).toEqual([]);
  });
});
