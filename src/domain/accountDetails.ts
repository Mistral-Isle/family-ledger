import type { Account, Snapshot, Txn } from "./types";
import { assertMoney } from "./money";

export function accountDelta(txn: Txn, accountId: string) {
  let delta = 0;
  if (txn.accountId === accountId)
    delta += ["income", "refund", "adjust", "scope_in"].includes(txn.type)
      ? txn.amount
      : -txn.amount;
  if (
    txn.toAccountId === accountId &&
    ["transfer", "repayment"].includes(txn.type)
  )
    delta += txn.amount;
  return delta;
}

export function accountHistory(
  data: Snapshot,
  account: Account,
  month: string,
) {
  let balance = account.initialBalance;
  const all = data.txns
    .filter(
      (t) =>
        !t.deleted &&
        t.scope === account.scope &&
        (t.accountId === account.id || t.toAccountId === account.id),
    )
    .sort(
      (a, b) =>
        a.occurredAt.localeCompare(b.occurredAt) ||
        (a.occurredTime ?? "23:59:59").localeCompare(
          b.occurredTime ?? "23:59:59",
        ) ||
        a.createdAt.localeCompare(b.createdAt) ||
        a.hlc.localeCompare(b.hlc) ||
        a.id.localeCompare(b.id),
    );
  const rows = all
    .map((txn) => {
      const delta = accountDelta(txn, account.id);
      balance = assertMoney(balance + delta);
      return { txn, delta, balance };
    })
    .filter((row) => !row.txn.discarded && row.txn.occurredAt.startsWith(month))
    .reverse();
  return {
    rows,
    inflow: rows.reduce((n, r) => assertMoney(n + Math.max(0, r.delta)), 0),
    outflow: rows.reduce((n, r) => assertMoney(n + Math.max(0, -r.delta)), 0),
  };
}

export function accountDeletionRows(data: Snapshot, accountId: string) {
  const ids = new Set(
    data.txns
      .filter(
        (t) =>
          !t.deleted &&
          (t.accountId === accountId || t.toAccountId === accountId),
      )
      .map((t) => t.id),
  );
  // Refunds may have arrived in another account; never leave orphan refunds.
  for (const t of data.txns)
    if (!t.deleted && t.refundOfId && ids.has(t.refundOfId)) ids.add(t.id);
  return [...ids];
}
