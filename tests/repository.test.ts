import { fixture } from "./sqlite";
import { accountBalance, totals, visibleTxns } from "../src/domain/selectors";
import type { Txn } from "../src/domain/types";
import { LedgerRepository } from "../src/db/repository";
import { randomUUID } from "node:crypto";

describe("single-device repository on real SQLite", () => {
  const opened: ReturnType<typeof fixture>[] = [];
  const setup = () => {
    const f = fixture();
    opened.push(f);
    return f;
  };
  afterEach(() => {
    opened.splice(0).forEach((f) => f.sqlite.close());
  });
  test("reopening keeps preferences and the operation sequence across clock rollback", () => {
    const { repo, driver } = setup();
    repo.updatePreferences({ mode: "daily" });
    const before = repo.snapshot();
    const operations = repo.pendingOperations();
    const reopened = new LedgerRepository(
      driver,
      randomUUID,
      () => "2026-10-01T00:00:00.000Z",
    );
    reopened.initialize();
    expect(reopened.snapshot()).toEqual(before);
    reopened.saveAccount({ name: "new", kind: "cash", initialBalance: 100 });
    const last = reopened.pendingOperations().at(-1)!;
    expect(last.seq).toBe(operations.at(-1)!.seq + 1);
    expect(last.hlc > operations.at(-1)!.hlc).toBe(true);
  });
  test("favorites cap at twelve and their presets stay out of the outbox", () => {
    const { repo } = setup();
    const s = repo.snapshot();
    const preset = {
      categoryId: s.categories[1]!.id,
      label: "preset",
      accountId: s.accounts[0]!.id,
      amount: 700,
      note: "local note",
    };
    for (let i = 0; i < 12; i++) repo.saveFavorite(preset);
    expect(() => repo.saveFavorite(preset)).toThrow();
    expect(repo.snapshot().preferences.favorites).toHaveLength(12);
    expect(repo.snapshot().pending).toBe(s.pending);
    expect(JSON.stringify(repo.pendingOperations())).not.toContain(
      "local note",
    );
  });
  test("archived accounts reject new entries but preserve existing entry edits", () => {
    const { repo } = setup();
    const s = repo.snapshot();
    const account = s.accounts[0]!;
    const input = {
      type: "expense" as const,
      amount: 100,
      accountId: account.id,
      categoryId: s.categories[1]!.id,
      occurredAt: "2026-10-29",
      note: "",
      forWhom: "me" as const,
    };
    repo.saveTxn(input);
    repo.saveAccount({ ...account, archived: true });
    expect(() => repo.saveTxn(input)).toThrow();
    const existing = repo.snapshot().txns[0]!;
    repo.saveTxn({ ...existing, amount: 200 });
    expect(
      accountBalance(repo.snapshot().accounts[0]!, repo.snapshot().txns),
    ).toBe(-200);
  });
  test("initialization is idempotent, UUIDs and default data persist", () => {
    const { repo } = setup();
    const before = repo.snapshot();
    repo.initialize();
    expect(repo.snapshot()).toEqual(before);
    expect(before.accounts).toHaveLength(3);
    expect(before.categories.length).toBeGreaterThan(30);
    expect(before.meId).toMatch(/^[a-f0-9-]{36}$/);
    expect(new Set(repo.pendingOperations().map((op) => op.hlc)).size).toBe(
      repo.pendingOperations().length,
    );
  });
  test("20 entries, edit, tombstone deletion, transfer and outbox stay consistent", () => {
    const { repo } = setup();
    const s = repo.snapshot();
    const account = s.accounts[0]!;
    const target = s.accounts[1]!;
    repo.saveAccount({ ...account, initialBalance: 100000 });
    const startOps = repo.snapshot().pending;
    const category = s.categories.find(
      (c) => c.kind === "expense" && c.parentId,
    )!;
    for (let i = 0; i < 20; i++)
      repo.saveTxn({
        type: "expense",
        amount: 101,
        accountId: account.id,
        categoryId: category.id,
        occurredAt: "2026-10-29",
        note: "",
        forWhom: "both",
      });
    let next = repo.snapshot();
    expect(accountBalance(next.accounts[0]!, next.txns)).toBe(97980);
    expect(next.pending - startOps).toBe(20);
    const first = next.txns[0]!;
    repo.saveTxn({ ...first, amount: 200 });
    repo.deleteTxn(next.txns[1]!.id);
    repo.saveTxn({
      type: "transfer",
      amount: 500,
      accountId: account.id,
      toAccountId: target.id,
      occurredAt: "2026-10-29",
      note: "",
      forWhom: "both",
    });
    next = repo.snapshot();
    expect(accountBalance(next.accounts[0]!, next.txns)).toBe(97482);
    expect(accountBalance(next.accounts[1]!, next.txns)).toBe(500);
    expect(totals(next.txns).expense).toBe(2018);
    expect(next.pending - startOps).toBe(23);
    expect(next.txns.find((t) => t.id === s.txns[0]?.id)).toBeUndefined();
    expect(
      repo.pendingOperations().filter((op) => op.action === "delete"),
    ).toHaveLength(1);
  });
  test("failed log insertion rolls back the entity and clock", () => {
    const { repo, sqlite } = setup();
    const before = repo.snapshot();
    sqlite.exec(
      "CREATE TRIGGER fail_log BEFORE INSERT ON outbox BEGIN SELECT RAISE(ABORT, 'simulated disk failure'); END",
    );
    expect(() =>
      repo.saveAccount({ name: "test", kind: "cash", initialBalance: 0 }),
    ).toThrow("simulated disk failure");
    expect(repo.snapshot()).toEqual(before);
  });
  test("local preferences never enter the outbox", () => {
    const { repo } = setup();
    const start = repo.snapshot().pending;
    repo.updatePreferences({ mode: "daily", pinned: [] });
    expect(repo.snapshot().pending).toBe(start);
    expect(
      repo
        .pendingOperations()
        .some((op) => (op.entity as string) === "local_pref"),
    ).toBe(false);
  });
  test("scope isolation validates both ends of transfers and excludes private writes", () => {
    const { repo, sqlite } = setup();
    const s = repo.snapshot();
    const family = s.accounts[0]!;
    sqlite
      .prepare("UPDATE account SET scope = ? WHERE id = ?")
      .run("private", s.accounts[1]!.id);
    const start = repo.snapshot().pending;
    const category = s.categories.find((c) => c.kind === "expense")!;
    repo.saveTxn({
      type: "expense",
      amount: 100,
      accountId: s.accounts[1]!.id,
      categoryId: category.id,
      occurredAt: "2026-10-29",
      note: "secret",
      forWhom: "me",
    });
    expect(repo.snapshot().pending).toBe(start);
    expect(JSON.stringify(repo.pendingOperations())).not.toContain("secret");
    expect(totals(repo.snapshot().txns).expense).toBe(0);
    expect(visibleTxns(repo.snapshot().txns)).toHaveLength(0);
    expect(() =>
      repo.saveTxn({
        type: "transfer",
        amount: 100,
        accountId: family.id,
        toAccountId: s.accounts[1]!.id,
        occurredAt: "2026-10-29",
        note: "",
        forWhom: "both",
      }),
    ).toThrow();
  });
  test("category hiding and renaming preserve balances; category moves cannot create cycles", () => {
    const { repo } = setup();
    const s = repo.snapshot();
    const child = s.categories.find((c) => c.parentId && c.kind === "expense")!;
    repo.saveTxn({
      type: "expense",
      amount: 700,
      accountId: s.accounts[0]!.id,
      categoryId: child.id,
      occurredAt: "2026-10-29",
      note: "",
      forWhom: "me",
    });
    const before = accountBalance(s.accounts[0]!, repo.snapshot().txns);
    repo.saveCategory({ ...child, name: "renamed", hidden: true });
    expect(accountBalance(s.accounts[0]!, repo.snapshot().txns)).toBe(before);
    const root = s.categories.find((c) => c.id === child.parentId)!;
    expect(() => repo.saveCategory({ ...root, parentId: child.id })).toThrow();
  });
  test("invalid dates, zero/float amounts and same-account transfer do not mutate anything", () => {
    const { repo } = setup();
    const s = repo.snapshot();
    const input = {
      type: "expense" as const,
      amount: 100,
      accountId: s.accounts[0]!.id,
      categoryId: s.categories.find((c) => c.kind === "expense")!.id,
      occurredAt: "2026-02-30",
      note: "",
      forWhom: "both" as const,
    };
    expect(() => repo.saveTxn(input)).toThrow();
    expect(() =>
      repo.saveTxn({ ...input, occurredAt: "2026-10-29", amount: 0.5 }),
    ).toThrow();
    expect(() =>
      repo.saveTxn({
        ...input,
        type: "transfer",
        occurredAt: "2026-10-29",
        toAccountId: input.accountId,
      }),
    ).toThrow();
    expect(repo.snapshot()).toEqual(s);
  });
  test("discarded rows still count toward historic balances and never toward totals", () => {
    const { repo } = setup();
    const s = repo.snapshot();
    const base = {
      id: "t",
      createdAt: "",
      updatedAt: "",
      hlc: "",
      deleted: false,
      scope: "family",
      type: "expense",
      amount: 100,
      accountId: s.accounts[0]!.id,
      toAccountId: null,
      categoryId: null,
      occurredAt: "2026-10-29",
      note: "",
      recorderMemberId: s.meId,
      forWhom: "me",
      discarded: true,
      refundOfId: null,
    } satisfies Txn;
    expect(accountBalance(s.accounts[0]!, [base], "2026-10-28")).toBe(0);
    expect(accountBalance(s.accounts[0]!, [base], "2026-10-29")).toBe(-100);
    expect(totals([base]).expense).toBe(0);
    expect(visibleTxns([base])).toHaveLength(0);
  });
});
