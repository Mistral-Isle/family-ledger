import { effectiveTripId, memberName, payerId } from "./travel";
import type { Snapshot, TxnType } from "./types";
import { visibleTxns } from "./selectors";

export function filterMonthTransactions(
  data: Snapshot,
  month: string,
  types: TxnType[],
  query: string,
) {
  const search = query.trim().toLocaleLowerCase();
  return visibleTxns(data.txns).filter((txn) => {
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
