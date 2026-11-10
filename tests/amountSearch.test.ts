import { amountMatchesQuery, searchTransactions } from "../src/domain/transactionFilters";
import type { Txn } from "../src/domain/types";
import { fixture } from "./sqlite";

test("a number matches amounts by yuan, then by the decimals typed", () => {
  expect(amountMatchesQuery(3200, "32")).toBe(true);
  expect(amountMatchesQuery(3250, "32")).toBe(true);
  expect(amountMatchesQuery(32000, "32")).toBe(false);
  expect(amountMatchesQuery(1320, "32")).toBe(false);
  expect(amountMatchesQuery(3250, "32.5")).toBe(true);
  expect(amountMatchesQuery(3259, "32.5")).toBe(true);
  expect(amountMatchesQuery(3260, "32.5")).toBe(false);
  expect(amountMatchesQuery(3250, "32.50")).toBe(true);
  expect(amountMatchesQuery(3251, "32.50")).toBe(false);
  expect(amountMatchesQuery(3200, "32.")).toBe(true);
  expect(amountMatchesQuery(-3200, "32")).toBe(true);
  expect(amountMatchesQuery(123456, "¥1,234.56")).toBe(true);
  expect(amountMatchesQuery(3200, "三十二")).toBe(false);
  expect(amountMatchesQuery(3200, "")).toBe(false);
});

test("search covers every month, newest first, and keeps the type and future filters", () => {
  const f = fixture();
  try {
    const initial = f.repo.snapshot();
    f.repo.saveTxn({ type: "expense", amount: 3200, categoryId: initial.categories.find(c => c.kind === "expense")!.id,
      accountId: initial.accounts[0]!.id, occurredAt: "2026-11-01", forWhom: "both", note: "" });
    const data = f.repo.snapshot();
    const base = data.txns[0]!;
    const txn = (id: string, fields: Partial<Txn> = {}): Txn => ({ ...base, id, ...fields });
    data.txns = [
      txn("old", { occurredAt: "2025-02-09", amount: 3200, type: "income" }),
      txn("recent", { occurredAt: "2026-11-01", amount: 3200 }),
      txn("other", { occurredAt: "2026-10-01", amount: 1850 }),
      txn("note", { occurredAt: "2026-09-30", amount: 500, note: "32 号快递" }),
      txn("future", { occurredAt: "2026-12-01", amount: 3200 }),
      txn("deleted", { occurredAt: "2026-10-02", amount: 3200, deleted: true }),
    ];
    expect(searchTransactions(data, [], "32").map(t => t.id)).toEqual(["future", "recent", "note", "old"]);
    expect(searchTransactions(data, ["income"], "32").map(t => t.id)).toEqual(["old"]);
    expect(searchTransactions(data, [], "32", new Date("2026-11-02T00:00:00Z")).map(t => t.id)).toEqual(["recent", "note", "old"]);
    expect(searchTransactions(data, [], "  ")).toEqual([]);
  } finally { f.sqlite.close(); }
});
