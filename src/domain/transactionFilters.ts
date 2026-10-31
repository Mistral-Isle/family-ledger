import { effectiveTripId, memberName, payerId } from "./travel";
import type { Snapshot, TxnType, Txn } from "./types";
import { visibleTxns } from "./selectors";

/** Ledger dates and optional times are interpreted in Shanghai time. Date-only entries remain visible today. */
export function isFutureTransaction(
  txn: Pick<Txn, "occurredAt" | "occurredTime">,
  now: Date,
) {
  const local = new Date(now.getTime() + 8 * 60 * 60 * 1000).toISOString();
  const date = local.slice(0, 10),
    time = local.slice(11, 16);
  return (
    txn.occurredAt > date ||
    (txn.occurredAt === date &&
      !!txn.occurredTime &&
      txn.occurredTime.slice(0, 5) > time)
  );
}

export function filterMonthTransactions(
  data: Snapshot,
  month: string,
  types: TxnType[],
  query: string,
  asOf?: Date,
) {
  const search = query.trim().toLocaleLowerCase();
  return visibleTxns(data.txns).filter((txn) => {
    if (asOf && isFutureTransaction(txn, asOf)) return false;
    if (
      !txn.occurredAt.startsWith(month) ||
      (types.length && !types.includes(txn.type))
    )
      return false;
    const category = data.categories.find((c) => c.id === txn.categoryId);
    const parent = data.categories.find((c) => c.id === category?.parentId);
    const account = data.accounts.find((a) => a.id === txn.accountId);
    const target = data.accounts.find((a) => a.id === txn.toAccountId);
    return `${memberName(data, payerId(data, txn))} ${memberName(data, txn.recorderMemberId)} ${data.trips?.find((t) => t.id === effectiveTripId(data, txn))?.name ?? ""} ${txn.note} ${category?.name ?? ""} ${parent?.name ?? ""} ${account?.name ?? ""} ${target?.name ?? ""}`
      .toLocaleLowerCase()
      .includes(search);
  });
}
