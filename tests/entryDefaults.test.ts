import { fixture } from "./sqlite";
import { accountBalance, firstCategory } from "../src/domain/selectors";
import {
  privacyAccountId,
  transferAccountName,
  transferDirection,
} from "../src/domain/privacyTransfer";

const diningChildren = (f: ReturnType<typeof fixture>) => {
  const s = f.repo.snapshot(),
    root = s.categories.find(
      (c) => !c.deleted && !c.parentId && c.name === "餐饮",
    )!;
  return s.categories
    .filter((c) => !c.deleted && c.parentId === root.id)
    .sort((a, b) => a.sort - b.sort)
    .map((c) => c.name);
};

test("new ledgers list 买菜食材 first and new entries preselect it", () => {
  const f = fixture();
  try {
    expect(diningChildren(f)).toEqual([
      "买菜食材",
      "日常用餐",
      "饮品",
      "零食水果",
    ]);
    const s = f.repo.snapshot();
    expect(firstCategory(s.categories, "expense")?.name).toBe("买菜食材");
    expect(
      s.categories.find(
        (c) => c.id === firstCategory(s.categories, "expense")?.parentId,
      )?.name,
    ).toBe("餐饮");
    // A root without children is selectable by itself.
    expect(firstCategory(s.categories, "income")?.parentId).toBeNull();
  } finally {
    f.sqlite.close();
  }
});

test("existing ledgers move 买菜食材 first once and keep a user-reordered list", () => {
  const f = fixture();
  try {
    const s = f.repo.snapshot(),
      root = s.categories.find((c) => !c.parentId && c.name === "餐饮")!,
      byName = (name: string) =>
        s.categories.find((c) => c.parentId === root.id && c.name === name)!;
    const restore = (names: string[]) => {
      f.repo.reorderCategories(names.map((n) => byName(n).id));
      f.sqlite.exec("DELETE FROM local_pref WHERE key = 'defaultChildOrderV1'");
      f.repo.initialize();
    };
    restore(["日常用餐", "买菜食材", "饮品", "零食水果"]);
    expect(diningChildren(f)).toEqual([
      "买菜食材",
      "日常用餐",
      "饮品",
      "零食水果",
    ]);
    restore(["饮品", "日常用餐", "买菜食材", "零食水果"]);
    expect(diningChildren(f)).toEqual([
      "饮品",
      "日常用餐",
      "买菜食材",
      "零食水果",
    ]);
  } finally {
    f.sqlite.close();
  }
});

test("transfers may leave one side outside the ledger but never both", () => {
  const f = fixture();
  try {
    const [a, b] = f.repo
      .snapshot()
      .accounts.filter((x) => x.scope === "family" && !x.archived);
    const base = { amount: 5000, occurredAt: "2026-11-01", note: "" };
    const incoming = f.repo.saveMemberTransfer({
      ...base,
      accountId: "",
      toAccountId: a!.id,
    });
    const outgoing = f.repo.saveMemberTransfer({
      ...base,
      accountId: b!.id,
      toAccountId: "",
    });
    expect(() =>
      f.repo.saveMemberTransfer({ ...base, accountId: "", toAccountId: "" }),
    ).toThrow("至少选择一个");
    expect(() =>
      f.repo.saveMemberTransfer({
        ...base,
        accountId: "",
        toAccountId: privacyAccountId(f.repo.snapshot().meId),
      }),
    ).toThrow("隐私账户");
    const s = f.repo.snapshot(),
      inRow = s.txns.find((t) => t.id === incoming)!,
      outRow = s.txns.find((t) => t.id === outgoing)!;
    expect([inRow.accountId, inRow.toAccountId]).toEqual(["", a!.id]);
    expect([outRow.accountId, outRow.toAccountId]).toEqual([b!.id, null]);
    expect(accountBalance(a!, s.txns)).toBe(a!.initialBalance + 5000);
    expect(accountBalance(b!, s.txns)).toBe(b!.initialBalance - 5000);
    expect(transferDirection(s, inRow)).toBe("转入");
    expect(transferDirection(s, outRow)).toBe("转出");
    expect(transferAccountName(s, inRow.accountId)).toBe("账外");

    const other = fixture();
    try {
      other.repo.restoreBackup(f.repo.exportBackup());
      expect(other.repo.snapshot().txns).toEqual(s.txns);
    } finally {
      other.sqlite.close();
    }
  } finally {
    f.sqlite.close();
  }
});

test("private-scope transfers may also leave one side outside the ledger", () => {
  const f = fixture();
  try {
    f.repo.saveAccount({
      name: "小金库",
      kind: "bank",
      scope: "private",
      initialBalance: 0,
    });
    const vault = f.repo
      .snapshot()
      .accounts.find((a) => a.scope === "private")!;
    const base = {
      type: "transfer" as const,
      amount: 1200,
      occurredAt: "2026-11-01",
      note: "",
      forWhom: "both" as const,
    };
    f.repo.saveTxn({ ...base, accountId: "", toAccountId: vault.id });
    f.repo.saveTxn({ ...base, amount: 200, accountId: vault.id });
    expect(() => f.repo.saveTxn({ ...base, accountId: "" })).toThrow(
      "至少选择一个",
    );
    expect(accountBalance(vault, f.repo.snapshot().txns)).toBe(1000);
  } finally {
    f.sqlite.close();
  }
});

test("entries may record 0 but never a negative amount", () => {
  const f = fixture();
  try {
    const s = f.repo.snapshot(),
      [a, b] = s.accounts.filter((x) => x.scope === "family" && !x.archived),
      category = s.categories.find((c) => c.kind === "expense" && c.parentId)!;
    const base = { occurredAt: "2026-11-01", note: "", forWhom: "both" as const };
    const id = f.repo.saveTxn({
      ...base,
      type: "expense",
      amount: 0,
      accountId: a!.id,
      categoryId: category.id,
    });
    expect(f.repo.snapshot().txns.find((t) => t.id === id)?.amount).toBe(0);
    expect(
      f.repo.saveMemberTransfer({
        ...base,
        amount: 0,
        accountId: a!.id,
        toAccountId: b!.id,
      }),
    ).toBeTruthy();
    expect(() =>
      f.repo.saveTxn({
        ...base,
        type: "expense",
        amount: -100,
        accountId: a!.id,
        categoryId: category.id,
      }),
    ).toThrow("负数");
    expect(() =>
      f.repo.saveTxn({
        ...base,
        type: "refund",
        amount: 0,
        accountId: a!.id,
        refundOfId: id,
      }),
    ).toThrow();
    const other = fixture();
    try {
      other.repo.restoreBackup(f.repo.exportBackup());
      other.repo.mergeOperations(f.repo.pendingOperations());
      expect(other.repo.snapshot().txns.some((t) => t.id === id)).toBe(true);
    } finally {
      other.sqlite.close();
    }
  } finally {
    f.sqlite.close();
  }
});
