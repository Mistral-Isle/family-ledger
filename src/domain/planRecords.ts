import type { FinancialPlan, Snapshot, Txn } from "./types";

const live = (s: Snapshot) => s.plans.filter((p) => !p.deleted);
const data = (p: FinancialPlan) => JSON.parse(p.data);

/** The live plan that wrote or tracks this row, if any. */
export function owningPlan(s: Snapshot, txn: Txn) {
  return live(s).find((p) => {
    const d = data(p);
    if ((d.txnIds ?? []).includes(txn.id)) return true;
    // Concurrent repayments may arrive before the plan lists them.
    return (
      p.kind === "loan" &&
      (txn.toAccountId === d.accountId || txn.accountId === d.accountId)
    );
  });
}

/** Rows written together by one lease payment: the transfer and its rent parts. */
function leasePayments(s: Snapshot, d: any) {
  const groups: Txn[][] = [];
  for (const id of d.txnIds as string[]) {
    const t = s.txns.find((t) => t.id === id && !t.deleted);
    if (!t) continue;
    if (t.type === "transfer" && t.toAccountId === d.accountId)
      groups.push([t]);
    else if (t.type === "expense" && t.accountId === d.accountId)
      groups.at(-1)?.push(t);
  }
  return groups;
}

export type PlanRowRemoval =
  | { error: string }
  | {
      planId: string;
      ids: string[];
      title: string;
      detail: string;
      /** The lease's only payment: undoing it removes the whole lease. */
      wholePlan?: boolean;
    };

/**
 * What deleting a plan row from the details undoes: one loan repayment (with
 * its interest), one calibration, or the latest lease payment with its rent
 * parts. Null when the row belongs to no plan and deletes normally.
 */
export function planRowRemoval(
  s: Snapshot,
  txnId: string,
): PlanRowRemoval | null {
  const txn = s.txns.find((t) => t.id === txnId && !t.deleted);
  if (!txn) return null;
  const plan = owningPlan(s, txn);
  if (!plan) return null;
  const d = data(plan);
  const ids: string[] = d.txnIds ?? [];
  if (plan.kind === "loan") {
    if (txn.id === d.borrowTxnId)
      return { error: "借款记录请在贷款卡片里修改或删除" };
    if (txn.type === "adjust")
      return {
        planId: plan.id,
        ids: [txn.id],
        title: "删除这次校准？",
        detail: "剩余本金会恢复到校准前。",
      };
    // Interest is written right after its repayment on the same day.
    const at = ids.indexOf(txn.id);
    const repayment =
      txn.type === "repayment"
        ? txn
        : s.txns.find(
            (t) =>
              !t.deleted &&
              t.id === ids[at - 1] &&
              t.type === "repayment" &&
              t.occurredAt === txn.occurredAt,
          );
    if (!repayment) return { error: "请在财务计划页面操作贷款记录" };
    const next = ids[ids.indexOf(repayment.id) + 1];
    const interest = s.txns.find(
      (t) =>
        !t.deleted &&
        t.id === next &&
        t.type === "expense" &&
        t.occurredAt === repayment.occurredAt,
    );
    return {
      planId: plan.id,
      ids: interest ? [repayment.id, interest.id] : [repayment.id],
      title: "撤销这次还款？",
      detail: interest
        ? "会同时删除这次还款的利息支出，已还期数和剩余本金会恢复。"
        : "已还期数和剩余本金会恢复。",
    };
  }
  if (plan.kind === "prepaid" && d.lease) {
    if (d.closed)
      return { error: "已结束的租赁不能撤销交租，可删除整个租赁后重新记录" };
    const groups = leasePayments(s, d);
    const at = groups.findIndex((g) => g.some((t) => t.id === txn.id));
    if (at < 0) return { error: "请在财务计划页面操作租赁记录" };
    // The first rent is written with the lease itself, so it goes only with it.
    if (at === 0 && groups.length === 1) {
      if (live(s).some((p) => data(p).renewedFrom === plan.id))
        return { error: "已有续签的租约，请先删除续签租约" };
      return {
        planId: plan.id,
        ids: [],
        wholePlan: true,
        title: "删除整个租赁？",
        detail: `这是「${plan.name}」唯一一期交租，撤销就等于删除这份租赁，会一并删除它的${d.depositPlanIds?.length ? "押金、" : ""}租金和分摊明细，不能恢复。`,
      };
    }
    if (at === 0)
      return { error: "首期租金随租赁一起记录，请先撤销之后的交租" };
    if (at !== groups.length - 1)
      return { error: "只能撤销最近一期交租，请先撤销之后的交租" };
    const parts = groups[at]!.length - 1;
    return {
      planId: plan.id,
      ids: groups[at]!.map((t) => t.id),
      title: `撤销第 ${d.paidPeriods} 期交租？`,
      detail:
        parts > 1
          ? `会同时删除这一期的 ${parts} 笔租金分摊明细。`
          : "会同时删除这一期计入的租金支出。",
    };
  }
  return {
    error:
      plan.kind === "deposit"
        ? "押金记录请在财务计划里修改或删除"
        : "请在财务计划页面操作整组记录",
  };
}

/** Date of the lease payment before the latest one, after undoing it. */
export function previousLeasePayment(s: Snapshot, d: any) {
  const groups = leasePayments(s, d);
  return groups.at(-2)?.[0]?.occurredAt ?? d.date;
}

/**
 * Accounts and rows left behind by removed plans (older versions archived a
 * lease's holding accounts instead of removing them). Rows that refunds point
 * at are kept so real money moves stay intact.
 */
export function leftoverRecords(s: Snapshot) {
  const plans = live(s);
  const owned = new Set(plans.map((p) => data(p).accountId));
  const removedPlanAccounts = new Set(
    s.plans.filter((p) => p.deleted).map((p) => data(p).accountId),
  );
  const accounts = s.accounts.filter(
    (a) =>
      !a.deleted &&
      a.scope === "family" &&
      !owned.has(a.id) &&
      (a.kind === "deposit" ||
        a.kind === "prepaid" ||
        (a.kind === "loan" && removedPlanAccounts.has(a.id))),
  );
  // Rows may still point at a holding account that is already gone.
  const accountIds = new Set([
    ...accounts.map((a) => a.id),
    ...s.accounts
      .filter(
        (a) =>
          a.deleted &&
          !owned.has(a.id) &&
          (a.kind === "deposit" || a.kind === "prepaid" || a.kind === "loan"),
      )
      .map((a) => a.id),
  ]);
  const ownedTxns = new Set(plans.flatMap((p) => data(p).txnIds ?? []));
  const removedTxns = new Set(
    s.plans.filter((p) => p.deleted).flatMap((p) => data(p).txnIds ?? []),
  );
  const refunded = new Set(
    s.txns.filter((t) => !t.deleted && t.refundOfId).map((t) => t.refundOfId),
  );
  const txns = s.txns.filter(
    (t) =>
      !t.deleted &&
      !ownedTxns.has(t.id) &&
      !refunded.has(t.id) &&
      (accountIds.has(t.accountId) ||
        accountIds.has(t.toAccountId ?? "") ||
        removedTxns.has(t.id)),
  );
  return { accounts, txns };
}
