import { zh } from "../i18n/zh";
import type { Snapshot, Txn } from "./types";
import { assertMoney } from "./money";
import { visibleTxns } from "./selectors";

export function sourceExpense(s: Snapshot, txn: Txn) {
  return txn.type === "refund"
    ? s.txns.find((t) => t.id === txn.refundOfId)
    : txn;
}
export function payerId(s: Snapshot, txn: Txn): string | null {
  return sourceExpense(s, txn)?.payerMemberId ?? null;
}
export function effectiveTripId(s: Snapshot, txn: Txn): string | null {
  const id = sourceExpense(s, txn)?.tripId;
  return s.trips?.some((t) => t.id === id && !t.deleted) ? id! : null;
}
export function tripTransactions(s: Snapshot, tripId: string) {
  return visibleTxns(s.txns).filter(
    (t) =>
      (t.type === "expense" || t.type === "refund") &&
      effectiveTripId(s, t) === tripId,
  );
}
export function netExpense(t: Txn) {
  if (t.excludeTotals) return 0;
  return t.type === "expense"
    ? t.amount
    : t.type === "refund"
      ? -(t.amount - (t.refundIncome ?? 0))
      : 0;
}
export function tripSummary(s: Snapshot, tripId: string) {
  const rows = tripTransactions(s, tripId);
  const members = new Map<string, number>(),
    categories = new Map<string, number>();
  let total = 0;
  for (const t of rows) {
    const n = netExpense(t),
      member = payerId(s, t) ?? "",
      category = t.categoryId ?? "";
    total = assertMoney(total + n);
    members.set(member, assertMoney((members.get(member) ?? 0) + n));
    categories.set(category, assertMoney((categories.get(category) ?? 0) + n));
  }
  return { rows, total, members: [...members], categories: [...categories] };
}
export function categoryPath(s: Snapshot, id: string | null) {
  const c = s.categories.find((c) => c.id === id),
    p = s.categories.find((p) => p.id === c?.parentId);
  return [p?.name, c?.name].filter(Boolean).join("／");
}
export function memberName(s: Snapshot, id: string | null | undefined) {
  return s.members.find((m) => m.id === id)?.name ?? zh.collaboration.unknown;
}

export type DuplicateMatch = { txn: Txn; strong: boolean };
export function duplicateCandidates(
  s: Snapshot,
  draft: Pick<Txn, "amount" | "accountId" | "occurredAt"> & Partial<Txn>,
): DuplicateMatch[] {
  if (draft.scope === "private" || (draft.type && draft.type !== "expense"))
    return [];
  return visibleTxns(s.txns)
    .flatMap((t) => {
      if (
        t.id === draft.id ||
        t.type !== "expense" ||
        t.amount !== draft.amount ||
        t.accountId !== draft.accountId
      )
        return [];
      if (t.occurredTime && draft.occurredTime) {
        const a = Date.parse(`${t.occurredAt}T${t.occurredTime}:00Z`),
          b = Date.parse(`${draft.occurredAt}T${draft.occurredTime}:00Z`);
        return Math.abs(a - b) <= 10 * 60000 ? [{ txn: t, strong: true }] : [];
      }
      return t.occurredAt === draft.occurredAt
        ? [{ txn: t, strong: false }]
        : [];
    })
    .sort((a, b) => Number(b.strong) - Number(a.strong));
}
export function duplicateFingerprint(a: Txn, b: Txn) {
  return JSON.stringify(
    [a, b]
      .sort((x, y) => x.id.localeCompare(y.id))
      .map((t) => [
        t.id,
        t.amount,
        t.accountId,
        t.occurredAt,
        t.occurredTime ?? null,
      ]),
  );
}
export function duplicatePairs(s: Snapshot) {
  const pairs: {
    first: Txn;
    second: Txn;
    strong: boolean;
    fingerprint: string;
  }[] = [];
  for (const first of visibleTxns(s.txns).filter((t) => t.type === "expense")) {
    for (const match of duplicateCandidates(s, first)) {
      if (first.id >= match.txn.id) continue;
      const fingerprint = duplicateFingerprint(first, match.txn);
      if (
        s.duplicates?.some((d) => !d.deleted && d.fingerprint === fingerprint)
      )
        continue;
      pairs.push({
        first,
        second: match.txn,
        strong: match.strong,
        fingerprint,
      });
    }
  }
  return pairs;
}
