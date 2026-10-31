import { randomUUID } from "node:crypto";
import { LedgerRepository } from "../src/db/repository";
import { detailViewSnapshot, filterMonthTransactions } from "../src/domain/transactionFilters";
import { reportingSnapshot, rangeTxns } from "../src/domain/reports";
import { totals } from "../src/domain/selectors";
import type { Txn } from "../src/domain/types";
import { useUi } from "../src/state/ui";
import { fixture } from "./sqlite";

test("mine uses payer rather than recorder or purpose, attributes refunds to the source, and agrees with statistics", () => {
  const f = fixture();
  try {
    const initial = f.repo.snapshot();
    f.repo.saveTxn({ type: "expense", amount: 10000, categoryId: initial.categories.find(c => c.kind === "expense")!.id,
      accountId: initial.accounts[0]!.id, occurredAt: "2026-11-01", forWhom: "both", note: "测试" });
    const data = f.repo.snapshot();
    const base = data.txns[0]!;
    const txn = (id: string, fields: Partial<Txn> = {}): Txn => ({ ...base, id, ...fields });
    data.txns = [
      txn("mine", { payerMemberId: data.meId, recorderMemberId: "partner", forWhom: "partner" }),
      txn("partner", { payerMemberId: "partner", recorderMemberId: data.meId, forWhom: "me", amount: 20000 }),
      txn("unknown", { payerMemberId: null, amount: 30000 }),
      txn("prior", { payerMemberId: data.meId, occurredAt: "2026-10-01" }),
      txn("refund", { type: "refund", payerMemberId: "partner", refundOfId: "prior", amount: 1000 }),
      txn("deleted", { payerMemberId: data.meId, deleted: true }),
      txn("discarded", { payerMemberId: data.meId, discarded: true }),
      txn("private", { payerMemberId: data.meId, scope: "private" }),
      txn("income", { type: "income", payerMemberId: null, amount: 50000 }),
      txn("future", { payerMemberId: data.meId, occurredAt: "2026-11-30" }),
    ];
    const original = structuredClone(data);
    const mine = detailViewSnapshot(data, "mine");
    const rows = filterMonthTransactions(mine, "2026-11", [], "");
    expect(rows.map(t => t.id).sort()).toEqual(["future", "income", "mine", "refund"]);
    expect(totals(rows)).toEqual(totals(rangeTxns(reportingSnapshot(data, data.meId, false, "payer").txns, { start: "2026-11-01", end: "2026-11-30" })));
    expect(filterMonthTransactions(mine, "2026-11", ["refund"], "测试").map(t => t.id)).toEqual(["refund"]);
    expect(totals(filterMonthTransactions(mine, "2026-11", [], "", new Date("2026-11-02T00:00:00Z"))).expense).toBe(9000);
    expect(filterMonthTransactions(detailViewSnapshot(data, "shared"), "2026-11", [], "").map(t => t.id).sort()).toEqual(["future", "income", "mine", "partner", "refund", "unknown"]);
    expect(detailViewSnapshot({ ...data, meId: "" }, "mine").txns).toEqual([]);
    expect(data).toEqual(original);
  } finally { f.sqlite.close(); }
});

test("detail view defaults to shared and remembers the local selection without changing accounting or sync records", () => {
  const f = fixture();
  try {
    const before = f.repo.snapshot();
    expect(f.repo.getDetailView()).toBe("shared");
    f.repo.setDetailView("mine");
    const reopened = new LedgerRepository(f.driver, randomUUID);
    expect(reopened.getDetailView()).toBe("mine");
    expect(reopened.snapshot()).toEqual(before);
    reopened.setDetailView("shared");
    expect(new LedgerRepository(f.driver, randomUUID).getDetailView()).toBe("shared");
  } finally { f.sqlite.close(); }
});

test("income attribution uses receiving account owner and falls back to recorder for shared accounts", () => {
  const f = fixture();
  try {
    const data = f.repo.snapshot();
    f.repo.saveTxn({ type: "income", amount: 50000, accountId: data.accounts[0]!.id,
      categoryId: data.categories.find(c => c.kind === "income")!.id, occurredAt: "2026-11-01", forWhom: "both", note: "工资" });
    const snapshot = f.repo.snapshot();
    const income = snapshot.txns[0]!;
    const account = snapshot.accounts.find(a => a.id === income.accountId)!;
    account.ownerMemberId = snapshot.meId;
    income.recorderMemberId = "partner";
    expect(detailViewSnapshot(snapshot, "mine").txns).toHaveLength(1);
    account.ownerMemberId = "partner";
    income.recorderMemberId = snapshot.meId;
    expect(detailViewSnapshot(snapshot, "mine").txns).toHaveLength(0);
    account.ownerMemberId = "";
    expect(detailViewSnapshot(snapshot, "mine").txns).toHaveLength(1);
    income.recorderMemberId = "partner";
    expect(detailViewSnapshot(snapshot, "mine").txns).toHaveLength(0);
    expect(detailViewSnapshot(snapshot, "shared").txns).toHaveLength(1);
  } finally { f.sqlite.close(); }
});

test("opening statistics carries the payer filter and a shared request clears a previous personal request", () => {
  const initial = useUi.getState();
  try {
    initial.openStats("expense", "my-id");
    expect(useUi.getState()).toMatchObject({ statsView: "expense", statsMemberId: "my-id", statsRequest: initial.statsRequest + 1 });
    useUi.getState().openStats("income");
    expect(useUi.getState()).toMatchObject({ statsView: "income", statsMemberId: "", statsRequest: initial.statsRequest + 2 });
  } finally { useUi.setState(initial); }
});
