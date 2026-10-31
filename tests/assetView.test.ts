import { randomUUID } from "node:crypto";
import { LedgerRepository } from "../src/db/repository";
import { assetViewAccounts, assetAccountGroups } from "../src/domain/assetView";
import { fixture } from "./sqlite";

test("personal assets use account ownership and family assets include each owner once, while excluding private/deleted accounts", () => {
  const f = fixture();
  try {
    const data = f.repo.snapshot(), base = data.accounts[0]!;
    data.members.push({ ...data.members[0]!, id: "partner", name: "对方" });
    data.accounts = [
      { ...base, id: "mine", ownerMemberId: data.meId, initialBalance: 10000 },
      { ...base, id: "theirs", ownerMemberId: "partner", initialBalance: -2000 },
      { ...base, id: "shared", ownerMemberId: "", initialBalance: 3000 },
      { ...base, id: "private", scope: "private", initialBalance: 8000 },
      { ...base, id: "deleted", deleted: true, initialBalance: 9000 },
      { ...base, id: "archived", archived: true, ownerMemberId: data.meId, initialBalance: 4000 },
    ];
    f.repo.saveTxn({ type: "expense", amount: 1000, accountId: base.id,
      categoryId: data.categories.find(c => c.kind === "expense")!.id,
      occurredAt: "2026-11-01", forWhom: "both", note: "" });
    const txn = f.repo.snapshot().txns[0]!;
    data.txns = [{ ...txn, accountId: "mine", recorderMemberId: "partner" },
      { ...txn, id: "future", accountId: "mine", occurredAt: "2027-01-01" }];
    const mine = assetViewAccounts(data, "mine", "2026-11-01");
    expect(mine.map(r => r.account.id).sort()).toEqual(["archived", "mine"]);
    expect(mine.reduce((n, r) => n + r.balance, 0)).toBe(13000);
    const family = assetViewAccounts(data, "family", "2026-11-01");
    expect(family.reduce((n, r) => n + r.balance, 0)).toBe(14000);
    const groups = assetAccountGroups(data, family);
    expect(groups.map(g => g.name)).toEqual(["我的账户", "对方的账户", "共同账户"]);
    expect(groups.flatMap(g => g.rows)).toHaveLength(family.length);
    expect(assetViewAccounts({ ...data, meId: "" }, "mine", "2026-11-01")).toEqual([]);
  } finally { f.sqlite.close(); }
});

test("asset view defaults to mine and persists locally without altering balances or outbox", () => {
  const f = fixture();
  try {
    const before = f.repo.snapshot(), outbox = f.sqlite.prepare("SELECT * FROM outbox ORDER BY seq").all();
    expect(f.repo.getAssetView()).toBe("mine");
    f.repo.setAssetView("family");
    const reopened = new LedgerRepository(f.driver, randomUUID);
    expect(reopened.getAssetView()).toBe("family");
    reopened.setAssetView("mine");
    expect(new LedgerRepository(f.driver, randomUUID).getAssetView()).toBe("mine");
    expect(f.repo.snapshot()).toEqual(before);
    expect(f.sqlite.prepare("SELECT * FROM outbox ORDER BY seq").all()).toEqual(outbox);
  } finally { f.sqlite.close(); }
});
