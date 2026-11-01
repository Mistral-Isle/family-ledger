import { randomBytes } from "node:crypto";
import { fixture } from "./sqlite";
import {
  synchronize,
  encryptOperations,
  decryptOperations,
  type SyncStore,
} from "../src/domain/sync";
class MemoryStore implements SyncStore {
  files = new Map<string, string>();
  dirs = new Set<string>();
  fail = false;
  async mkdir(path: string) {
    this.dirs.add(path);
  }
  async list(path: string) {
    return [
      ...new Set(
        [...this.dirs, ...this.files.keys()]
          .filter((p) => p.startsWith(path + "/"))
          .map((p) => p.slice(path.length + 1).split("/")[0]!),
      ),
    ].reverse();
  }
  async get(path: string) {
    if (!this.files.has(path))
      throw Object.assign(new Error("missing"), { status: 404 });
    return this.files.get(path)!;
  }
  async put(path: string, text: string) {
    if (this.fail) throw new Error("offline");
    this.files.set(path, text);
  }
  async move(from: string, to: string) {
    this.files.set(to, this.files.get(from)!);
    this.files.delete(from);
  }
}
const config = { ledgerId: "family-test", keyHex: "01".repeat(32) };
test("authenticated encryption rejects tampering, wrong family and private payloads", () => {
  const f = fixture();
  try {
    const ops = f.repo.pendingOperations(),
      text = encryptOperations(
        ops,
        config.keyHex,
        config.ledgerId,
        randomBytes(24),
      );
    expect(decryptOperations(text, config.keyHex, config.ledgerId)).toEqual(
      ops,
    );
    expect(() =>
      decryptOperations(text, "02".repeat(32), config.ledgerId),
    ).toThrow();
    expect(() => decryptOperations(text, config.keyHex, "other")).toThrow();
    const modified = JSON.parse(text);
    const lastByte = parseInt(modified.cipher.slice(-2), 16);
    modified.cipher = modified.cipher.slice(0, -2) + (lastByte ^ 1).toString(16).padStart(2, "0");
    expect(() =>
      decryptOperations(
        JSON.stringify(modified),
        config.keyHex,
        config.ledgerId,
      ),
    ).toThrow();
    const privateOp = structuredClone(
      ops.find((op) => op.entity === "account")!,
    );
    (privateOp.record as any).scope = "private";
    expect(() =>
      encryptOperations(
        [privateOp],
        config.keyHex,
        config.ledgerId,
        randomBytes(24),
      ),
    ).toThrow();
  } finally {
    f.sqlite.close();
  }
});
test("two offline devices converge with duplicate, reversed delivery and concurrent edits", async () => {
  const a = fixture(),
    b = fixture(),
    store = new MemoryStore();
  try {
    b.repo.prepareJoin("另一位");
    await synchronize(a.repo, store, config, randomBytes);
    await synchronize(b.repo, store, config, randomBytes);
    await synchronize(a.repo, store, config, randomBytes);
    const sa = a.repo.snapshot();
    expect(sa.members).toHaveLength(2);
    expect(b.repo.snapshot().accounts).toEqual(sa.accounts);
    const input = {
      type: "expense" as const,
      amount: 100,
      accountId: sa.accounts[0]!.id,
      categoryId: sa.categories.find((c) => c.kind === "expense")!.id,
      occurredAt: "2026-10-01",
      note: "A",
      forWhom: "both" as const,
    };
    for (let i = 0; i < 10; i++) {
      a.repo.saveTxn({ ...input, note: "A" + i });
      b.repo.saveTxn({ ...input, note: "B" + i });
    }
    store.fail = true;
    await expect(
      synchronize(a.repo, store, config, randomBytes),
    ).rejects.toThrow("offline");
    expect(a.repo.pendingOperations()).toHaveLength(10);
    store.fail = false;
    await synchronize(a.repo, store, config, randomBytes);
    await synchronize(b.repo, store, config, randomBytes);
    await synchronize(a.repo, store, config, randomBytes);
    const common = a.repo.snapshot().txns[0]!;
    a.repo.saveTxn({ ...common, note: "A changed" });
    b.repo.saveTxn({ ...common, note: "B changed" });
    const ao = a.repo.pendingOperations(),
      bo = b.repo.pendingOperations();
    a.repo.mergeOperations([...bo, ...bo].reverse());
    b.repo.mergeOperations([...ao, ...ao].reverse());
    const sort = (rows: any[]) =>
      rows.slice().sort((x, y) => x.id.localeCompare(y.id));
    expect(sort(a.repo.snapshot().txns)).toEqual(sort(b.repo.snapshot().txns));
    expect(a.repo.snapshot().txns).toHaveLength(20);
    await synchronize(a.repo, store, config, randomBytes);
    await synchronize(b.repo, store, config, randomBytes);
    await synchronize(a.repo, store, config, randomBytes);
    expect(sort(a.repo.snapshot().txns)).toEqual(sort(b.repo.snapshot().txns));
    expect(a.repo.pendingOperations()).toHaveLength(0);
    for (const text of store.files.values())
      expect(text).not.toContain("A changed");
  } finally {
    a.sqlite.close();
    b.sqlite.close();
  }
});
test("invalid remote record rolls back the whole batch and never overwrites private data", () => {
  const a = fixture(),
    b = fixture();
  try {
    a.repo.saveAccount({
      name: "PRIVATE",
      kind: "cash",
      scope: "private",
      initialBalance: 0,
    });
    const priv = a.repo.snapshot().accounts.find((a) => a.scope === "private")!;
    const op = structuredClone(
      b.repo.pendingOperations().find((op) => op.entity === "account")!,
    );
    op.entityId = priv.id;
    op.record.id = priv.id;
    const before = a.repo.snapshot();
    expect(() =>
      a.repo.mergeOperations([b.repo.pendingOperations()[0]!, op]),
    ).toThrow();
    expect(a.repo.snapshot()).toEqual(before);
    const malicious = structuredClone(op);
    (malicious.record as any)["unexpected"] = 1;
    expect(() => a.repo.mergeOperations([malicious])).toThrow();
  } finally {
    a.sqlite.close();
    b.sqlite.close();
  }
});

test("wrong recovery key fails before publishing any device data", async () => {
  const a = fixture(),
    b = fixture(),
    store = new MemoryStore();
  try {
    await synchronize(a.repo, store, config, randomBytes);
    const before = [...store.files];
    await expect(
      synchronize(
        b.repo,
        store,
        { ...config, keyHex: "02".repeat(32), allowCreate: false },
        randomBytes,
      ),
    ).rejects.toThrow();
    expect([...store.files]).toEqual(before);
  } finally {
    a.sqlite.close();
    b.sqlite.close();
  }
});

test("monthly budgets converge even when both devices create the month offline", () => {
  const a = fixture(),
    b = fixture();
  try {
    a.repo.setMonthBudget("2026-10", 10000);
    b.repo.setMonthBudget("2026-10", 20000);
    const aa = a.repo.pendingOperations().filter((o) => o.entity === "budget"),
      bb = b.repo.pendingOperations().filter((o) => o.entity === "budget");
    a.repo.mergeOperations(bb);
    b.repo.mergeOperations(aa);
    expect(a.repo.monthBudget("2026-10")).toBe(b.repo.monthBudget("2026-10"));
    a.repo.setMonthBudget("2026-10", null);
    b.repo.mergeOperations(
      a.repo.pendingOperations().filter((o) => o.entity === "budget"),
    );
    expect(b.repo.monthBudget("2026-10")).toBeNull();
  } finally {
    a.sqlite.close();
    b.sqlite.close();
  }
});
test("concurrent offline loan repayments retain both amounts and advance two periods", () => {
  const a = fixture(),
    b = fixture();
  try {
    b.repo.prepareJoin("B");
    b.repo.mergeOperations(a.repo.pendingOperations());
    const s = a.repo.snapshot();
    a.repo.createLoan({
      name: "共同贷款",
      principal: 100000,
      paymentAccountId: s.accounts[0]!.id,
      monthlyPayment: 10000,
      dueDay: 15,
      totalPeriods: 12,
      paidPeriods: 0,
      interestFreePeriods: 3,
      settlePeriod: 3,
      nextDueDate: "2026-10-15",
    });
    b.repo.mergeOperations(a.repo.pendingOperations());
    const p = a.repo.snapshot().plans[0]!;
    const input = {
      amount: 10000,
      interest: 0,
      date: "2026-10-29",
      categoryId: s.categories.find((c) => c.kind === "expense")!.id,
    };
    a.repo.payLoan(p.id, input);
    b.repo.payLoan(p.id, input);
    const ao = a.repo.pendingOperations(),
      bo = b.repo.pendingOperations();
    a.repo.mergeOperations(bo);
    b.repo.mergeOperations(ao);
    const ad = JSON.parse(a.repo.snapshot().plans[0]!.data),
      bd = JSON.parse(b.repo.snapshot().plans[0]!.data);
    expect(ad.paidPeriods).toBe(2);
    expect(bd.paidPeriods).toBe(2);
    expect(ad.nextDueDate).toBe("2026-12-15");
    expect(bd.nextDueDate).toBe(ad.nextDueDate);
    expect(
      a.repo.snapshot().txns.filter((t) => t.type === "repayment"),
    ).toHaveLength(2);
  } finally {
    a.sqlite.close();
    b.sqlite.close();
  }
});
test("shared category deletion updates private records locally without emitting private operations", () => {
  const a = fixture(),
    b = fixture();
  try {
    b.repo.prepareJoin("B");
    b.repo.mergeOperations(a.repo.pendingOperations());
    b.repo.saveAccount({
      name: "私有",
      kind: "cash",
      initialBalance: 10000,
      scope: "private",
    });
    const s = b.repo.snapshot(),
      privateAccount = s.accounts.find((a) => a.scope === "private")!,
      category = s.categories.find((c) => c.kind === "expense" && c.parentId)!;
    b.repo.saveTxn({
      type: "expense",
      amount: 100,
      accountId: privateAccount.id,
      categoryId: category.id,
      occurredAt: "2026-10-29",
      note: "秘密",
      forWhom: "me",
    });
    const count = b.repo.pendingOperations().length;
    a.repo.deleteCategory(category.id, { action: "discard" });
    b.repo.mergeOperations(a.repo.pendingOperations());
    expect(
      b.repo.snapshot().txns.find((t) => t.scope === "private")?.discarded,
    ).toBe(true);
    expect(b.repo.pendingOperations()).toHaveLength(count);
    expect(JSON.stringify(b.repo.pendingOperations())).not.toContain("秘密");
    const target = b.repo
      .snapshot()
      .categories.find((c) => !c.deleted && c.kind === "expense")!;
    b.repo.restoreDiscardedTxn(b.repo.snapshot().txns[0]!.id, target.id);
    expect(b.repo.snapshot().txns[0]!.discarded).toBe(false);
    expect(b.repo.pendingOperations()).toHaveLength(count);
  } finally {
    a.sqlite.close();
    b.sqlite.close();
  }
});
test("concurrent prepayment edits converge to one group even with reversed child operations", () => {
  const a = fixture(),
    b = fixture();
  try {
    b.repo.prepareJoin("B");
    b.repo.mergeOperations(a.repo.pendingOperations());
    const s = a.repo.snapshot();
    const input = {
      name: "房租",
      amount: 90000,
      paymentAccountId: s.accounts[0]!.id,
      categoryId: s.categories.find((c) => c.kind === "expense")!.id,
      date: "2026-10-01",
      startMonth: "2026-10",
      months: 3,
      day: 1,
    };
    a.repo.savePrepayment(input);
    b.repo.mergeOperations(a.repo.pendingOperations());
    const id = a.repo.snapshot().plans[0]!.id;
    a.repo.savePrepayment({ ...input, id, amount: 120000 });
    b.repo.savePrepayment({ ...input, id, amount: 150000 });
    const ao = a.repo.pendingOperations(),
      bo = b.repo.pendingOperations();
    a.repo.mergeOperations([...bo].reverse());
    b.repo.mergeOperations([...ao].reverse());
    const as = a.repo.snapshot(),
      bs = b.repo.snapshot(),
      data = JSON.parse(as.plans[0]!.data);
    expect(JSON.parse(bs.plans[0]!.data).amount).toBe(data.amount);
    expect(as.txns.filter((t) => !t.deleted)).toHaveLength(4);
    expect(bs.txns.filter((t) => !t.deleted)).toHaveLength(4);
    expect(
      as.txns
        .filter((t) => !t.deleted && t.type === "expense")
        .reduce((n, t) => n + t.amount, 0),
    ).toBe(data.amount);
  } finally {
    a.sqlite.close();
    b.sqlite.close();
  }
});
test("partner edits and deletes family transfer shell while private counterpart stays local", () => {
  const a = fixture(),
    b = fixture();
  try {
    a.repo.saveAccount({
      name: "秘密账户",
      kind: "cash",
      initialBalance: 0,
      scope: "private",
    });
    const s = a.repo.snapshot(),
      privateAccount = s.accounts.find((a) => a.scope === "private")!;
    a.repo.transferScopes({
      fromId: s.accounts.find((a) => a.scope === "family")!.id,
      toId: privateAccount.id,
      amount: 1000,
      occurredAt: "2026-10-29",
      note: "私有备注",
    });
    b.repo.prepareJoin("B");
    b.repo.mergeOperations(a.repo.pendingOperations());
    const shell = b.repo.snapshot().txns[0]!;
    b.repo.editScopeShell(shell.id, 2000, "2026-10-30");
    a.repo.mergeOperations(b.repo.pendingOperations());
    const local = a.repo.snapshot().txns.find((t) => t.scope === "private")!;
    expect(local.amount).toBe(2000);
    expect(local.occurredAt).toBe("2026-10-30");
    expect(local.note).toBe("私有备注");
    expect(JSON.stringify(b.repo.snapshot())).not.toContain("私有备注");
    b.repo.deleteTxn(shell.id);
    a.repo.mergeOperations(b.repo.pendingOperations());
    expect(a.repo.snapshot().txns.every((t) => t.deleted)).toBe(true);
    expect(b.repo.snapshot().accounts.some((a) => a.scope === "private")).toBe(
      false,
    );
  } finally {
    a.sqlite.close();
    b.sqlite.close();
  }
});
