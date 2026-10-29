import { fixture } from "./sqlite";
import { LedgerRepository } from "../src/db/repository";
import { randomUUID } from "node:crypto";
import {
  accountBalance,
  categoryAmounts,
  totals,
  visibleTxns,
} from "../src/domain/selectors";
import { categoryDeletionImpact } from "../src/domain/categoryDeletion";

describe("reversible category deletion", () => {
  let f: ReturnType<typeof fixture>;
  beforeEach(() => {
    f = fixture();
  });
  afterEach(() => f.sqlite.close());
  function setup() {
    const s = f.repo.snapshot();
    const child = s.categories.find((c) => c.parentId && c.kind === "expense")!;
    const target = s.categories.find(
      (c) => !c.parentId && c.kind === "expense" && c.id !== child.parentId,
    )!;
    f.repo.saveTxn({
      type: "expense",
      amount: 10000,
      accountId: s.accounts[0]!.id,
      categoryId: child.id,
      occurredAt: "2026-09-20",
      note: "",
      forWhom: "both",
    });
    const source = f.repo.snapshot().txns[0]!;
    f.repo.saveTxn({
      type: "refund",
      amount: 12000,
      accountId: s.accounts[1]!.id,
      refundOfId: source.id,
      occurredAt: "2026-10-29",
      note: "",
      forWhom: "both",
    });
    f.repo.saveFavorite({
      categoryId: child.id,
      accountId: source.accountId,
      label: "常用",
      note: "",
    });
    return { child, target, source };
  }
  function balances() {
    const s = f.repo.snapshot();
    return ["2026-09-30", "2026-10-30"].map((date) =>
      s.accounts.map((a) => accountBalance(a, s.txns, date)),
    );
  }
  test.each(["migrate", "create", "discard"] as const)(
    "%s preserves balances and restores after reopening",
    (action) => {
      const { child, target } = setup();
      const before = f.repo.snapshot();
      const balance = balances();
      const impact = categoryDeletionImpact(before, child.parentId!);
      expect(impact.txns).toHaveLength(2);
      expect(impact.favorites).toHaveLength(1);
      f.repo.deleteCategory(
        child.parentId!,
        action === "migrate"
          ? { action, targetId: target.id }
          : action === "create"
            ? { action, name: "接收分类" }
            : { action },
      );
      const after = f.repo.snapshot();
      expect(after.preferences.favorites).toEqual(
        action === "discard"
          ? []
          : before.preferences.favorites.map((f) => ({
              ...f,
              categoryId: after.txns[0]!.categoryId,
            })),
      );
      expect(balances()).toEqual(balance);
      expect(
        after.categories
          .filter((c) => impact.categories.some((i) => i.id === c.id))
          .every((c) => c.deleted),
      ).toBe(true);
      expect(
        after.txns.map((t) => [t.amount, t.refundIncome, t.refundOfId]),
      ).toEqual(
        before.txns.map((t) => [t.amount, t.refundIncome, t.refundOfId]),
      );
      if (action === "discard") {
        expect(visibleTxns(after.txns)).toHaveLength(0);
        expect(totals(after.txns)).toEqual({
          expense: 0,
          income: 0,
          balance: 0,
        });
        expect(categoryAmounts(after.txns, "income").size).toBe(0);
      } else {
        expect(totals(after.txns)).toEqual(totals(before.txns));
        expect(after.txns[0]!.categoryId).toBe(after.txns[1]!.categoryId);
      }
      const reopened = new LedgerRepository(f.driver, randomUUID);
      reopened.restoreCategoryDeletion(
        reopened.categoryDeletionHistory()[0]!.id,
      );
      expect(balances()).toEqual(balance);
      expect(totals(reopened.snapshot().txns)).toEqual(totals(before.txns));
      expect(
        reopened.snapshot().txns.map((t) => [t.categoryId, t.discarded]),
      ).toEqual(before.txns.map((t) => [t.categoryId, t.discarded]));
      expect(reopened.categoryDeletionHistory()).toEqual([]);
      expect(reopened.snapshot().preferences).toEqual(before.preferences);
    },
  );
  test("income deletion migrates the excess allocation without changing expense category", () => {
    setup();
    const before = f.repo.snapshot();
    const refund = before.txns.find((t) => t.type === "refund")!;
    const target = before.categories.find(
      (c) => c.kind === "income" && c.id !== refund.refundIncomeCategoryId,
    )!;
    f.repo.deleteCategory(refund.refundIncomeCategoryId!, {
      action: "migrate",
      targetId: target.id,
    });
    const next = f.repo.snapshot().txns.find((t) => t.id === refund.id)!;
    expect(next.categoryId).toBe(refund.categoryId);
    expect(next.refundIncomeCategoryId).toBe(target.id);
    expect(
      categoryAmounts(f.repo.snapshot().txns, "income").get(target.id),
    ).toBe(2000);
  });
  test("invalid destinations and names roll back without any mutations", () => {
    const { child } = setup();
    const before = f.repo.snapshot();
    for (const targetId of [
      child.id,
      child.parentId!,
      "missing",
      before.categories.find((c) => c.kind === "income")!.id,
    ]) {
      expect(() =>
        f.repo.deleteCategory(child.parentId!, { action: "migrate", targetId }),
      ).toThrow();
      expect(f.repo.snapshot()).toEqual(before);
    }
    expect(() =>
      f.repo.deleteCategory(child.id, { action: "create", name: " " }),
    ).toThrow();
    expect(f.repo.snapshot()).toEqual(before);
  });
  test("later edits prevent restore without overwriting them", () => {
    const { child, target, source } = setup();
    f.repo.deleteCategory(child.id, { action: "migrate", targetId: target.id });
    const row = f.repo.snapshot().txns.find((t) => t.id === source.id)!;
    f.repo.saveTxn({ ...row, note: "later edit" });
    const before = f.repo.snapshot();
    expect(() =>
      f.repo.restoreCategoryDeletion(f.repo.categoryDeletionHistory()[0]!.id),
    ).toThrow("发生变化");
    expect(f.repo.snapshot()).toEqual(before);
  });
  test("outbox failure rolls back deletion, new category, history and clocks", () => {
    const { child } = setup();
    const before = f.repo.snapshot();
    const prefs = f.sqlite.prepare("SELECT * FROM local_pref").all();
    f.sqlite.exec(
      "CREATE TRIGGER fail_category_delete BEFORE INSERT ON outbox WHEN NEW.op_json LIKE '%\"entity\":\"txn\"%' BEGIN SELECT RAISE(ABORT, 'forced'); END",
    );
    expect(() =>
      f.repo.deleteCategory(child.parentId!, {
        action: "create",
        name: "接收",
      }),
    ).toThrow("forced");
    expect(f.repo.snapshot()).toEqual(before);
    expect(f.sqlite.prepare("SELECT * FROM local_pref").all()).toEqual(prefs);
  });
  test("outbox failure rolls back restore", () => {
    const { child } = setup();
    f.repo.deleteCategory(child.id, { action: "discard" });
    const before = f.repo.snapshot();
    const history = f.repo.categoryDeletionHistory();
    f.sqlite.exec(
      "CREATE TRIGGER fail_restore BEFORE INSERT ON outbox WHEN NEW.op_json LIKE '%\"entity\":\"txn\"%' BEGIN SELECT RAISE(ABORT, 'forced'); END",
    );
    expect(() => f.repo.restoreCategoryDeletion(history[0]!.id)).toThrow(
      "forced",
    );
    expect(f.repo.snapshot()).toEqual(before);
    expect(f.repo.categoryDeletionHistory()).toEqual(history);
  });

  test("new linked refunds prevent inconsistent category restoration", () => {
    const { child, target, source } = setup();
    f.repo.deleteCategory(child.id, { action: "migrate", targetId: target.id });
    f.repo.saveTxn({
      type: "refund",
      amount: 100,
      accountId: source.accountId,
      refundOfId: source.id,
      occurredAt: "2026-10-30",
      note: "",
      forWhom: "both",
    });
    const before = f.repo.snapshot();
    expect(() =>
      f.repo.restoreCategoryDeletion(f.repo.categoryDeletionHistory()[0]!.id),
    ).toThrow("新增了关联退款");
    expect(f.repo.snapshot()).toEqual(before);
  });
  test("discarding excess income removes the whole refund from reports, not balances", () => {
    setup();
    const before = balances();
    const refund = f.repo.snapshot().txns.find((t) => t.type === "refund")!;
    f.repo.deleteCategory(refund.refundIncomeCategoryId!, {
      action: "discard",
    });
    expect(totals(f.repo.snapshot().txns)).toEqual({
      expense: 10000,
      income: 0,
      balance: -10000,
    });
    expect(balances()).toEqual(before);
    f.repo.restoreCategoryDeletion(f.repo.categoryDeletionHistory()[0]!.id);
    expect(totals(f.repo.snapshot().txns).income).toBe(2000);
  });
  test("last visible root requires a replacement", () => {
    const root = f.repo
      .snapshot()
      .categories.find((c) => c.kind === "income" && !c.parentId)!;
    const before = f.repo.snapshot();
    expect(() => f.repo.deleteCategory(root.id, { action: "discard" })).toThrow(
      "至少一个",
    );
    expect(f.repo.snapshot()).toEqual(before);
    f.repo.deleteCategory(root.id, { action: "create", name: "新收入" });
    expect(
      f.repo
        .snapshot()
        .categories.some((c) => !c.deleted && c.name === "新收入"),
    ).toBe(true);
  });
});
