import { fixture } from "./sqlite";
import {
  accountOrder,
  favoriteFromTransaction,
} from "../src/domain/localShortcuts";
import {
  reorderShortcuts,
  saveTransactionFavorite,
  reorderVisibleFavorites,
} from "../src/services/localShortcuts";
import { createSubmissionGuard } from "../src/domain/submission";

test("inline favorite sorting preserves other visible kinds and rejects removed items without resurrecting them", () => {
  const f = ledger();
  try {
    for (const name of ["早餐", "工资", "午餐"])
      saveTransactionFavorite(f.repo, f.id, name);
    const before = f.repo.snapshot();
    const [a, b, c] = before.preferences.favorites;
    reorderVisibleFavorites(f.repo, [c!.id, a!.id]);
    expect(f.repo.snapshot().preferences.favorites.map((f) => f.id)).toEqual([
      c!.id,
      b!.id,
      a!.id,
    ]);
    expect(f.repo.snapshot().txns).toEqual(before.txns);
    expect(f.repo.snapshot().pending).toBe(before.pending);
    f.repo.updatePreferences({ favorites: [b!, c!] });
    expect(() => reorderVisibleFavorites(f.repo, [c!.id, a!.id])).toThrow(
      "列表已变化",
    );
    expect(f.repo.snapshot().preferences.favorites).toEqual([b!, c!]);
  } finally {
    f.sqlite.close();
  }
});

function ledger() {
  const f = fixture(),
    s = f.repo.snapshot();
  const account = s.accounts.find((a) => a.scope === "family")!;
  const category = s.categories.find(
    (c) => c.kind === "expense" && c.parentId,
  )!;
  const id = f.repo.saveTxn({
    type: "expense",
    amount: 1234,
    accountId: account.id,
    categoryId: category.id,
    occurredAt: "2026-11-01",
    note: "早餐备注",
    forWhom: "both",
  });
  return { ...f, id, account, category };
}

test("saving from a transaction copies its template without changing balances, rows or sync operations; rapid submit is guarded", () => {
  const f = ledger();
  try {
    const before = f.repo.snapshot();
    const guard = createSubmissionGuard();
    const save = () => saveTransactionFavorite(f.repo, f.id, "工作日早餐");
    expect(guard.run(save)).toBe(true);
    expect(guard.run(save)).toBe(false);
    const after = f.repo.snapshot();
    expect(after.preferences.favorites).toEqual([
      {
        id: expect.any(String),
        label: "工作日早餐",
        categoryId: f.category.id,
        accountId: f.account.id,
        amount: 1234,
        note: "早餐备注",
      },
    ]);
    expect(after.txns).toEqual(before.txns);
    expect(after.accounts).toEqual(before.accounts);
    expect(after.pending).toBe(before.pending);
  } finally {
    f.sqlite.close();
  }
});

test("favorites and pinned accounts retain their order after backup restore, without writing household logs", () => {
  const f = ledger();
  try {
    saveTransactionFavorite(f.repo, f.id, "早餐");
    saveTransactionFavorite(f.repo, f.id, "午餐");
    const s = f.repo.snapshot();
    const favorites = s.preferences.favorites.map((f) => f.id).reverse();
    const pinned = [...s.preferences.pinned].reverse();
    reorderShortcuts(f.repo, "favorites", favorites);
    reorderShortcuts(f.repo, "pinned", pinned);
    const next = f.repo.snapshot();
    expect(next.pending).toBe(s.pending);
    expect(next.txns).toEqual(s.txns);
    expect(next.preferences.favorites.map((f) => f.id)).toEqual(favorites);
    expect(next.preferences.pinned).toEqual(pinned);
    expect(
      [...next.accounts]
        .sort(accountOrder(pinned))
        .slice(0, pinned.length)
        .map((a) => a.id),
    ).toEqual(pinned);
    f.repo.restoreBackup(f.repo.exportBackup());
    expect(f.repo.snapshot().preferences).toEqual(next.preferences);
  } finally {
    f.sqlite.close();
  }
});

test.each(["favorites", "pinned"] as const)(
  "rejects stale, duplicate or foreign %s order without changing preferences",
  (kind) => {
    const f = ledger();
    try {
      saveTransactionFavorite(f.repo, f.id, "早餐");
      saveTransactionFavorite(f.repo, f.id, "午餐");
      const before = f.repo.snapshot();
      const ids =
        kind === "pinned"
          ? before.preferences.pinned
          : before.preferences.favorites.map((f) => f.id);
      for (const invalid of [
        ids.slice(1),
        ids.map(() => ids[0]!),
        ["unknown", ...ids.slice(1)],
      ]) {
        expect(() => reorderShortcuts(f.repo, kind, invalid)).toThrow(
          "列表已变化",
        );
        expect(f.repo.snapshot()).toEqual(before);
      }
    } finally {
      f.sqlite.close();
    }
  },
);

test("stale favorite ordering uses current content and never restores a removed favorite", () => {
  const f = ledger();
  try {
    saveTransactionFavorite(f.repo, f.id, "早餐");
    saveTransactionFavorite(f.repo, f.id, "午餐");
    const items = f.repo.snapshot().preferences.favorites;
    const ids = items.map((f) => f.id).reverse();
    f.repo.updatePreferences({
      favorites: items.map((f) => ({ ...f, note: "新备注" })),
    });
    reorderShortcuts(f.repo, "favorites", ids);
    expect(
      f.repo.snapshot().preferences.favorites.every((f) => f.note === "新备注"),
    ).toBe(true);
    f.repo.updatePreferences({ favorites: items.slice(1) });
    expect(() => reorderShortcuts(f.repo, "favorites", ids)).toThrow(
      "列表已变化",
    );
    expect(f.repo.snapshot().preferences.favorites).toEqual(items.slice(1));
  } finally {
    f.sqlite.close();
  }
});

test.each([
  "private",
  "refund",
  "transfer",
  "deleted",
  "discarded",
  "hidden",
  "hidden-parent",
  "archived",
])("does not offer a favorite for %s records", (reason) => {
  const f = ledger();
  try {
    const s = f.repo.snapshot(),
      txn = s.txns.find((t) => t.id === f.id)!;
    if (reason === "private") txn.scope = "private";
    if (reason === "refund" || reason === "transfer") txn.type = reason;
    if (reason === "deleted") txn.deleted = true;
    if (reason === "discarded") txn.discarded = true;
    if (reason === "hidden")
      s.categories.find((c) => c.id === txn.categoryId)!.hidden = true;
    if (reason === "hidden-parent")
      s.categories.find((c) => c.id === f.category.parentId)!.hidden = true;
    if (reason === "archived")
      s.accounts.find((a) => a.id === txn.accountId)!.archived = true;
    expect(favoriteFromTransaction(s, f.id)).toBeNull();
  } finally {
    f.sqlite.close();
  }
});

test("rechecks source at confirmation and enforces the existing 12-template limit", () => {
  const f = ledger();
  try {
    for (let i = 0; i < 12; i++)
      saveTransactionFavorite(f.repo, f.id, `早餐${i}`);
    const before = f.repo.snapshot();
    expect(() => saveTransactionFavorite(f.repo, f.id, "第十三项")).toThrow();
    expect(f.repo.snapshot()).toEqual(before);
    f.repo.deleteTxn(f.id);
    expect(() => saveTransactionFavorite(f.repo, f.id, "已删除账单")).toThrow(
      "暂不能存为常用",
    );
  } finally {
    f.sqlite.close();
  }
});
