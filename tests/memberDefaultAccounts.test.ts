import { fixture } from "./sqlite";
import { assetViewAccounts } from "../src/domain/assetView";
import { entryAccountGroups } from "../src/domain/entryAccounts";

test("new and joining members have distinct default accounts, shared family totals and own entry choices", () => {
  const a = fixture(), b = fixture();
  try {
    b.repo.prepareJoin("另一位");
    for (const f of [a, b]) {
      const s = f.repo.snapshot();
      expect(s.accounts.map(a => a.kind)).toEqual(["bank", "alipay", "wechat"]);
      expect(s.accounts.every(a => a.ownerMemberId === s.meId && a.scope === "family")).toBe(true);
      expect(s.preferences.pinned).toEqual(s.accounts.map(a => a.id));
    }
    a.repo.mergeOperations(b.repo.pendingOperations());
    b.repo.mergeOperations(a.repo.pendingOperations());
    for (const f of [a, b]) {
      f.repo.initialize();
      const s = f.repo.snapshot();
      expect(s.accounts).toHaveLength(6);
      expect(assetViewAccounts(s, "mine", "2026-11-01")).toHaveLength(3);
      expect(assetViewAccounts(s, "family", "2026-11-01")).toHaveLength(6);
      expect(entryAccountGroups(s.accounts, s.meId).mine.map(a => a.kind)).toEqual(["bank", "alipay", "wechat"]);
    }
  } finally { a.sqlite.close(); b.sqlite.close(); }
});

test("legacy upgrade fills missing personal defaults once and preserves existing balances, names and archive state", () => {
  const f = fixture();
  try {
    f.sqlite.exec("DELETE FROM local_pref WHERE key LIKE 'memberDefaultAccountsV1:%'");
    f.sqlite.exec("UPDATE account SET kind='cash', name='旧现金', initial_balance=321 WHERE kind='alipay'");
    f.sqlite.exec("UPDATE account SET name='工资卡', archived=1 WHERE kind='bank'");
    const before = f.repo.snapshot();
    f.repo.initialize();
    const after = f.repo.snapshot();
    expect(after.accounts).toHaveLength(4);
    for (const account of before.accounts) expect(after.accounts.find(a => a.id === account.id)).toEqual(account);
    const added = after.accounts.find(a => a.kind === "alipay")!;
    expect(added.initialBalance).toBe(0);
    f.sqlite.prepare("UPDATE account SET deleted=1 WHERE id=?").run(added.id);
    f.repo.initialize();
    expect(f.repo.snapshot().accounts).toHaveLength(4);
    expect(f.repo.snapshot().accounts.find(a => a.id === added.id)?.deleted).toBe(true);
  } finally { f.sqlite.close(); }
});

test("an existing joined member with no own accounts receives three personal defaults", () => {
  const a = fixture(), b = fixture();
  try {
    b.repo.prepareJoin("另一位");
    b.sqlite.prepare("DELETE FROM account WHERE owner_member_id=?").run(b.repo.snapshot().meId);
    b.sqlite.exec("DELETE FROM local_pref WHERE key LIKE 'memberDefaultAccountsV1:%'");
    b.repo.mergeOperations(a.repo.pendingOperations());
    b.repo.initialize();
    const s = b.repo.snapshot();
    expect(s.accounts.filter(a => a.ownerMemberId === s.meId)).toHaveLength(3);
    expect(s.accounts).toHaveLength(6);
  } finally { a.sqlite.close(); b.sqlite.close(); }
});
