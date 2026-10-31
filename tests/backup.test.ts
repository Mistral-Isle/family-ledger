import { fixture } from "./sqlite";
import { accountBalance } from "../src/domain/selectors";
import { LedgerRepository } from "../src/db/repository";
import { randomUUID } from "node:crypto";

describe("full backup and restore", () => {
  let f: ReturnType<typeof fixture>;
  beforeEach(() => {
    f = fixture();
  });
  afterEach(() => f.sqlite.close());
  function seed() {
    const s = f.repo.snapshot();
    const c = s.categories.find((c) => c.kind === "expense" && c.parentId)!;
    f.repo.saveTxn({
      type: "expense",
      amount: 10000,
      accountId: s.accounts[0]!.id,
      categoryId: c.id,
      occurredAt: "2026-10-01",
      note: "备份测试",
      forWhom: "both",
    });
    const source = f.repo.snapshot().txns[0]!;
    f.repo.saveTxn({
      type: "refund",
      amount: 12000,
      accountId: s.accounts[1]!.id,
      refundOfId: source.id,
      occurredAt: "2026-10-02",
      note: "",
      forWhom: "both",
    });
    f.repo.saveFavorite({
      categoryId: c.id,
      accountId: source.accountId,
      label: "常用",
      note: "",
    });
    f.repo.deleteCategory(c.id, { action: "discard" });
    f.repo.setTheme("dark");
  }
  test("round trip includes discarded data, preferences, history, outbox and clock", () => {
    seed();
    const before = f.repo.snapshot();
    const backup = f.repo.exportBackup();
    const other = fixture();
    try {
      other.repo.restoreBackup(backup);
      expect(other.repo.snapshot()).toEqual(before);
      expect(other.repo.getTheme()).toBe("dark");
      expect(other.repo.pendingOperations()).toEqual(
        f.repo.pendingOperations(),
      );
      expect(other.repo.categoryDeletionHistory()).toEqual(
        f.repo.categoryDeletionHistory(),
      );
      const reopened = new LedgerRepository(other.driver, randomUUID);
      reopened.initialize();
      expect(reopened.snapshot()).toEqual(before);
      reopened.restoreCategoryDeletion(
        reopened.categoryDeletionHistory()[0]!.id,
      );
      expect(reopened.snapshot().txns.every((t) => !t.discarded)).toBe(true);
      expect(
        accountBalance(
          reopened.snapshot().accounts[0]!,
          reopened.snapshot().txns,
        ),
      ).toBe(-10000);
      const last = before.categories[0]!;
      reopened.saveCategory({ ...last, name: "恢复后修改" });
      expect(reopened.pendingOperations().at(-1)!.seq).toBeGreaterThan(
        f.repo.pendingOperations().at(-1)!.seq,
      );
    } finally {
      other.sqlite.close();
    }
  });
  test.each([
    "json",
    "version",
    "column",
    "amount",
    "account",
    "preferences",
    "duplicate",
    "scope",
  ])("rejects %s corruption before changing database", (mutation) => {
    seed();
    const before = f.repo.exportBackup();
    const value = JSON.parse(before);
    if (mutation === "version") value.version = 9;
    if (mutation === "column") value.tables.txn[0].unexpected = "x";
    if (mutation === "amount") value.tables.txn[0].amount = 1.5;
    if (mutation === "account") value.tables.txn[0].account_id = "missing";
    if (mutation === "scope") value.tables.txn[0].scope = "private";
    if (mutation === "duplicate")
      value.tables.account.push(value.tables.account[0]);
    if (mutation === "preferences")
      value.tables.local_pref.find((p: any) => p.key === "preferences").value =
        "{}";
    expect(() =>
      f.repo.restoreBackup(mutation === "json" ? "{" : JSON.stringify(value)),
    ).toThrow();
    expect(JSON.parse(f.repo.exportBackup()).tables).toEqual(
      JSON.parse(before).tables,
    );
  });
  test("write failure rolls back every table and local preference", () => {
    seed();
    const backup = f.repo.exportBackup();
    f.repo.saveAccount({
      name: "后来新增",
      kind: "cash",
      initialBalance: 2000,
    });
    const before = JSON.parse(f.repo.exportBackup()).tables;
    f.sqlite.exec(
      "CREATE TRIGGER fail_restore BEFORE INSERT ON txn BEGIN SELECT RAISE(ABORT, 'forced'); END",
    );
    expect(() => f.repo.restoreBackup(backup)).toThrow("forced");
    expect(JSON.parse(f.repo.exportBackup()).tables).toEqual(before);
  });
  test("inspection is read-only and includes private rows only in full backup", () => {
    f.sqlite.exec("UPDATE account SET scope='private' WHERE name='现金'");
    const before = f.repo.snapshot();
    const backup = f.repo.exportBackup();
    expect(
      f.repo
        .inspectBackup(backup)
        .tables.account.some((a) => a.scope === "private"),
    ).toBe(true);
    expect(f.repo.snapshot()).toEqual(before);
  });
});
test.each([1, 2])(
  "legacy backup version %s upgrades missing new tables",
  (version) => {
    const f = fixture();
    try {
      const raw = JSON.parse(f.repo.exportBackup());
      raw.version = version;
      delete raw.tables.budget;
      if (version === 1) delete raw.tables.plan;
      const parsed = f.repo.inspectBackup(JSON.stringify(raw));
      expect(parsed.version).toBe(6);
      expect(parsed.tables.plan).toEqual([]);
      expect(parsed.tables.budget).toEqual([]);
    } finally {
      f.sqlite.close();
    }
  },
);
