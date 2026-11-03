import type { Category, Snapshot } from "./types";
import { assertMoney } from "./money";
import { leaseParts, leaseSchedule, type LeaseTerms } from "./lease";
import { loanAdvance, loanNextAmount, type LoanData } from "./finance";
import { accountBalance } from "./selectors";
import { today } from "./date";

/**
 * What each plan-backed category is expected to spend in a month: the rent
 * shares of leases and the installments of loans counted as spending. A
 * category with a finished plan is still listed, with zero.
 */
export function planMonthAmounts(
  s: Snapshot,
  month: string,
): Map<string, number> {
  const amounts = new Map<string, number>();
  const add = (id: string, amount: number) =>
    amounts.set(id, assertMoney((amounts.get(id) ?? 0) + amount));
  for (const plan of s.plans) {
    if (plan.deleted) continue;
    const d = JSON.parse(plan.data);
    if (plan.kind === "prepaid" && d.lease && d.categoryId) {
      add(d.categoryId, 0);
      let schedule: ReturnType<typeof leaseSchedule>;
      try {
        schedule = leaseSchedule(d.lease as LeaseTerms);
      } catch {
        continue;
      }
      const ended: string | undefined = d.endedAt;
      for (const period of schedule) {
        if (ended && period.start > ended) break;
        for (const part of leaseParts(period, d.lease))
          if (part.date.startsWith(month) && (!ended || part.date <= ended))
            add(d.categoryId, part.amount);
      }
    }
    if (plan.kind === "loan" && d.expenseCategoryId)
      loanMonth(s, d, month, (amount) => add(d.expenseCategoryId, amount));
  }
  return amounts;
}

/** Repayments made in the month as paid, plus installments still due in it. */
function loanMonth(
  s: Snapshot,
  d: LoanData,
  month: string,
  add: (amount: number) => void,
) {
  add(0);
  const ids = new Set(d.txnIds ?? []);
  for (const t of s.txns)
    if (
      ids.has(t.id) &&
      !t.deleted &&
      t.id !== d.borrowTxnId &&
      t.occurredAt.startsWith(month)
    )
      add(t.amount);
  if (d.closed || !d.nextDueDate) return;
  const account = s.accounts.find((a) => a.id === d.accountId);
  let remaining = account ? -accountBalance(account, s.txns) : 0;
  let paid = d.paidPeriods;
  for (let due = d.nextDueDate, i = 0; remaining > 0 && i < 1200; i++) {
    if (due.slice(0, 7) > month) break;
    const amount = loanNextAmount({ ...d, paidPeriods: paid }, remaining);
    if (due.startsWith(month)) add(amount);
    if (d.oneTime) break;
    remaining = assertMoney(remaining - amount);
    paid++;
    due = loanAdvance(d, due, 1);
  }
}

/** A category budget following its plan; `total` when it was added on top of the total. */
export type BudgetLink = { id: string; total: boolean };

/**
 * Linked category budgets follow their plans from the current month on, so a
 * finished lease or loan drops out by itself. A budget that was added on top
 * moves its parent and the total with it; one carved out of existing room
 * hands that room back. Earlier months keep what was saved.
 */
export function linkedBudget(
  month: string,
  total: number | null,
  allocations: Record<string, number>,
  links: BudgetLink[],
  amounts: Map<string, number>,
  categories: Category[],
  now = today(),
) {
  const active = links.filter((l) => amounts.has(l.id) && l.id in allocations);
  const linked = new Set(active.map((l) => l.id));
  if (total === null || month < now.slice(0, 7))
    return { total, allocations, linked };
  let nextTotal = total;
  const next = { ...allocations };
  for (const link of active) {
    const delta = assertMoney(amounts.get(link.id)! - allocations[link.id]!);
    next[link.id] = amounts.get(link.id)!;
    if (!link.total) continue;
    const parent = categories.find((c) => c.id === link.id)?.parentId;
    if (parent && parent in next)
      next[parent] = Math.max(0, assertMoney(next[parent]! + delta));
    nextTotal = Math.max(0, assertMoney(nextTotal + delta));
  }
  return { total: nextTotal, allocations: next, linked };
}

/**
 * Closed categories that still spend (or have a plan) but no budget of their
 * own: the daily budget cannot leave them out. Suggests the plan amount, or
 * else last month's spending, falling back to this month's.
 */
export function unbudgetedClosedCategories(
  s: Snapshot,
  month: string,
  allocations: Record<string, number>,
  excludedIds: string[],
  usage: (month: string) => Map<string, number>,
  amounts: Map<string, number>,
) {
  const previous = (() => {
    const [y, m] = month.split("-").map(Number) as [number, number];
    const d = new Date(Date.UTC(y, m - 2, 1));
    return d.toISOString().slice(0, 7);
  })();
  const thisMonth = usage(month),
    lastMonth = usage(previous);
  const excluded = new Set(excludedIds);
  return s.categories
    .filter(
      (c) =>
        !c.deleted &&
        c.kind === "expense" &&
        excluded.has(c.id) &&
        !(c.parentId && excluded.has(c.parentId)) &&
        // A zero amount leaves the same gap as none.
        !(allocations[c.id]! > 0) &&
        !s.categories.some(
          (child) =>
            child.parentId === c.id &&
            !child.deleted &&
            allocations[child.id]! > 0,
        ),
    )
    .map((c) => {
      const planned = amounts.get(c.id) ?? 0;
      const suggested =
        planned || lastMonth.get(c.id) || thisMonth.get(c.id) || 0;
      return {
        category: c,
        planned: amounts.has(c.id),
        suggested: Math.max(0, suggested),
      };
    })
    .filter((row) => row.suggested > 0);
}

/** The month's budget as shown: saved amounts with linked categories following their plans. */
export function monthBudgetView(
  s: Snapshot,
  month: string,
  total: number | null,
  allocations: Record<string, number>,
  links: BudgetLink[],
  now = today(),
) {
  return linkedBudget(
    month,
    total,
    allocations,
    links,
    planMonthAmounts(s, month),
    s.categories,
    now,
  );
}
