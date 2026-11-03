import { assertMoney } from "./money";
import { validDate, today } from "./date";
import { leaseSchedule, leaseUnits, type LeaseUnit } from "./lease";
export type LoanData = {
  accountId: string;
  paymentAccountId: string;
  /** Amount of each installment; the last one takes whatever is left. */
  monthlyPayment: number;
  dueDay: number;
  totalPeriods: number;
  paidPeriods: number;
  interestFreePeriods: number;
  settlePeriod: number;
  /** Empty only for a one-time loan without a due date. */
  nextDueDate: string;
  closed: boolean;
  txnIds?: string[];
  initialPaidPeriods?: number;
  initialNextDueDate?: string;
  /** Repayment cycle; older loans omit it and repay monthly. */
  unit?: LeaseUnit;
  every?: number;
  /** Repaid in one go (or in parts as money allows) instead of installments. */
  oneTime?: boolean;
  /** Amount borrowed and when; older loans only tracked the remaining principal. */
  principal?: number;
  date?: string;
  /** Where the borrowed money arrived; null when it went straight to the seller. */
  receiveAccountId?: string | null;
  borrowTxnId?: string;
  archived?: boolean;
  /** Repayments count as spending in this category (principal and interest). */
  expenseCategoryId?: string | null;
};
/** What the loan form collects; installment fields are ignored for one-time loans. */
export type LoanInput = {
  name: string;
  principal: number;
  date: string;
  receiveAccountId: string | null;
  paymentAccountId: string;
  oneTime: boolean;
  unit: LeaseUnit;
  every: number;
  periods: number;
  /** Fixed installment; null spreads the principal evenly. */
  installment: number | null;
  freePeriods: number;
  paidPeriods: number;
  /** First installment, or the due date of a one-time loan (may be empty). */
  firstDue: string;
  /** Count repayments as spending; without a category one named 车贷 is used. */
  countAsExpense?: boolean;
  expenseCategoryId?: string | null;
};
function shiftDays(date: string, n: number) {
  const d = new Date(validDate(date) + "T00:00:00Z");
  d.setUTCDate(d.getUTCDate() + n);
  return d.toISOString().slice(0, 10);
}
/** Due date `count` periods after `date`; monthly cycles keep their due day. */
export function loanAdvance(
  d: Pick<LoanData, "unit" | "every" | "dueDay">,
  date: string,
  count: number,
) {
  const unit = d.unit ?? "month",
    every = d.every ?? 1;
  if (unit === "day" || unit === "week")
    return shiftDays(date, count * every * (unit === "week" ? 7 : 1));
  return addMonths(date, count * every * (unit === "year" ? 12 : 1), d.dueDay);
}
export function loanCycleLabel(
  d: Pick<LoanData, "unit" | "every" | "oneTime">,
) {
  if (d.oneTime) return "一次还清";
  const every = d.every ?? 1;
  return `每${every === 1 ? "" : every}${leaseUnits[d.unit ?? "month"].label}`;
}
/** Even installments with the rounding on the last one, unless a fixed amount is given. */
export function loanInstallment(
  principal: number,
  periods: number,
  fixed?: number | null,
) {
  assertMoney(principal);
  if (!Number.isSafeInteger(periods) || periods < 1 || periods > 1200)
    throw new Error("还款期数须在 1–1200 之间");
  const each = fixed ?? Number(BigInt(principal) / BigInt(periods));
  assertMoney(each);
  const last = principal - each * (periods - 1);
  if (each <= 0 || last <= 0) throw new Error("每期还款与借款金额对不上");
  return { each, last };
}
/** Suggested amount for the next repayment; the final one clears the rest. */
export function loanNextAmount(d: LoanData, remaining: number) {
  if (d.oneTime || d.paidPeriods >= d.totalPeriods - 1) return remaining;
  return Math.min(d.monthlyPayment, remaining);
}
export function monthDate(month: string, day: number) {
  validDate(month + "-01");
  if (!Number.isInteger(day) || day < 1 || day > 31)
    throw new Error("每月日期须在 1–31 之间");
  const d = new Date(month + "-01T00:00:00Z");
  d.setUTCMonth(d.getUTCMonth() + 1);
  d.setUTCDate(0);
  return month + "-" + String(Math.min(day, d.getUTCDate())).padStart(2, "0");
}
export function addMonths(
  date: string,
  count: number,
  day = Number(date.slice(-2)),
) {
  validDate(date);
  const d = new Date(date.slice(0, 7) + "-01T00:00:00Z");
  d.setUTCMonth(d.getUTCMonth() + count);
  return monthDate(d.toISOString().slice(0, 7), day);
}
export function nextDue(day: number, at = today()) {
  const date = monthDate(at.slice(0, 7), day);
  return date < at ? addMonths(date, 1, day) : date;
}
export function validateLoan(d: LoanData) {
  if (
    !Number.isSafeInteger(d.monthlyPayment) ||
    d.monthlyPayment <= 0 ||
    ![
      d.totalPeriods,
      d.paidPeriods,
      d.interestFreePeriods,
      d.settlePeriod,
    ].every(Number.isSafeInteger) ||
    d.totalPeriods < 1 ||
    d.totalPeriods > 1200 ||
    typeof d.closed !== "boolean" ||
    (d.txnIds !== undefined &&
      (!Array.isArray(d.txnIds) ||
        !d.txnIds.every((id) => typeof id === "string"))) ||
    d.paidPeriods < 0 ||
    d.paidPeriods > d.totalPeriods ||
    d.interestFreePeriods < 0 ||
    d.interestFreePeriods > d.totalPeriods ||
    d.settlePeriod < d.paidPeriods ||
    d.settlePeriod > d.totalPeriods
  )
    throw new Error("贷款期数或金额无效");
  if (
    (d.unit !== undefined &&
      !Object.prototype.hasOwnProperty.call(leaseUnits, d.unit)) ||
    (d.every !== undefined &&
      (!Number.isSafeInteger(d.every) ||
        d.every < 1 ||
        d.every > leaseUnits[d.unit ?? "month"].max)) ||
    (d.oneTime !== undefined && typeof d.oneTime !== "boolean") ||
    (d.oneTime && d.totalPeriods !== 1) ||
    (d.principal !== undefined &&
      (!Number.isSafeInteger(d.principal) || d.principal <= 0)) ||
    (d.receiveAccountId !== undefined &&
      d.receiveAccountId !== null &&
      typeof d.receiveAccountId !== "string") ||
    (d.borrowTxnId !== undefined && typeof d.borrowTxnId !== "string")
  )
    throw new Error("贷款还款方式无效");
  if (d.date !== undefined) validDate(d.date);
  // Only a one-time loan may leave its due date open.
  const dueless = !!d.oneTime && !d.nextDueDate;
  if (d.initialPaidPeriods !== undefined) {
    if (
      !Number.isSafeInteger(d.initialPaidPeriods) ||
      d.initialPaidPeriods < 0 ||
      d.initialPaidPeriods > d.totalPeriods ||
      (!d.initialNextDueDate && !dueless)
    )
      throw new Error("贷款初始期数无效");
    if (d.initialNextDueDate) validDate(d.initialNextDueDate);
  }
  if (dueless) return d;
  validDate(d.nextDueDate);
  monthDate(d.nextDueDate.slice(0, 7), d.dueDay);
  return d;
}
export function loanProjection(d: LoanData, principal: number, at = today()) {
  validateLoan(d);
  assertMoney(principal);
  if (principal < 0) throw new Error("剩余本金不能为负");
  const remaining = Math.max(0, d.settlePeriod - d.paidPeriods);
  const deadline =
    remaining && d.nextDueDate
      ? loanAdvance(d, d.nextDueDate, remaining - 1)
      : at;
  const amount = Math.max(
    0,
    assertMoney(principal - assertMoney(remaining * d.monthlyPayment)),
  );
  return {
    amount,
    deadline,
    days: Math.round((Date.parse(deadline) - Date.parse(at)) / 86400000),
    freeRemaining: Math.max(0, d.interestFreePeriods - d.paidPeriods),
    estimated: d.settlePeriod > d.interestFreePeriods,
  };
}
export function splitPrepayment(
  amount: number,
  months: number,
  startMonth: string,
  day: number,
) {
  assertMoney(amount);
  if (
    amount <= 0 ||
    !Number.isInteger(months) ||
    months < 1 ||
    months > 120 ||
    amount < months
  )
    throw new Error("分摊月数或金额无效");
  const base = Number(BigInt(amount) / BigInt(months));
  const start = monthDate(startMonth, day);
  return Array.from({ length: months }, (_, i) => ({
    date: addMonths(start, i, day),
    amount: i === months - 1 ? amount - base * (months - 1) : base,
  }));
}
export function rentSchedule(
  monthlyRent: number,
  depositMonths: number,
  prepayMonths: number,
  start: string,
) {
  validDate(start);
  if (
    !Number.isSafeInteger(depositMonths) ||
    depositMonths < 0 ||
    depositMonths > 120
  )
    throw new Error("押金月数无效");
  const deposit = assertMoney(monthlyRent * depositMonths),
    prepaid = assertMoney(monthlyRent * prepayMonths);
  const parts = splitPrepayment(
    prepaid,
    prepayMonths,
    start.slice(0, 7),
    Number(start.slice(-2)),
  );
  const next = addMonths(start, prepayMonths);
  return {
    deposit,
    prepaid,
    total: assertMoney(deposit + prepaid),
    parts,
    next,
  };
}
export function validatePlanData(kind: "loan" | "deposit" | "prepaid", d: any) {
  if (
    !d ||
    typeof d.accountId !== "string" ||
    typeof d.paymentAccountId !== "string" ||
    typeof d.closed !== "boolean"
  )
    throw new Error("财务计划格式无效");
  if (kind === "loan") return validateLoan(d);
  if (
    !Array.isArray(d.txnIds) ||
    d.txnIds.length > 10000 ||
    !d.txnIds.every((id: unknown) => typeof id === "string") ||
    !Number.isSafeInteger(d.amount) ||
    d.amount <= 0
  )
    throw new Error("财务计划格式无效");
  validDate(d.date);
  if (kind === "prepaid")
    splitPrepayment(d.amount, d.months, d.startMonth, d.day);
  if (kind === "prepaid" && d.lease) {
    if (d.rentSettlement !== undefined) {
      const r = d.rentSettlement;
      if (
        !r ||
        !d.closed ||
        typeof r.accountId !== "string" ||
        ![r.returned, r.unused, r.withheld].every(Number.isSafeInteger) ||
        r.returned < 0 ||
        r.unused < 0 ||
        r.withheld !== Math.max(0, r.unused - r.returned) ||
        r.date !== d.endedAt
      )
        throw new Error("租金退租结算记录无效");
      validDate(r.date);
    }
    if (d.depositSettlement !== undefined) {
      const settlement = d.depositSettlement;
      if (
        !settlement ||
        !d.closed ||
        !Array.isArray(settlement.depositIds) ||
        !settlement.depositIds.length ||
        !settlement.depositIds.every((id: unknown) => typeof id === "string") ||
        new Set(settlement.depositIds).size !== settlement.depositIds.length ||
        typeof settlement.accountId !== "string" ||
        typeof settlement.categoryId !== "string" ||
        ![settlement.total, settlement.returned, settlement.deducted].every(
          Number.isSafeInteger,
        ) ||
        settlement.returned < 0 ||
        settlement.deducted < 0 ||
        settlement.total !== settlement.returned + settlement.deducted ||
        settlement.date < d.endedAt
      )
        throw new Error("租赁押金结算记录无效");
      validDate(settlement.date);
    }
    if (
      d.depositPlanIds !== undefined &&
      (!Array.isArray(d.depositPlanIds) ||
        !d.depositPlanIds.every((id: unknown) => typeof id === "string") ||
        new Set(d.depositPlanIds).size !== d.depositPlanIds.length)
    )
      throw new Error("租赁押金关联无效");
    const schedule = leaseSchedule(d.lease);
    if (
      !Number.isSafeInteger(d.paidPeriods) ||
      d.paidPeriods < 1 ||
      d.paidPeriods > schedule.length ||
      typeof d.name !== "string" ||
      (d.renewedFrom !== undefined && typeof d.renewedFrom !== "string")
    )
      throw new Error("租赁付款记录无效");
    validDate(d.lastPaymentDate);
    if (d.endedAt !== undefined) {
      validDate(d.endedAt);
      if (!d.closed || d.endedAt < d.lease.start)
        throw new Error("租赁结束日期无效");
    }
    // Rent may be paid late; older leases still required payment before each period.
    if (
      d.lastPaymentDate < d.date ||
      (!d.lease.split &&
        (d.date > d.lease.start ||
          d.lastPaymentDate > schedule[d.paidPeriods - 1]!.start))
    )
      throw new Error("租赁付款日期无效");
    if (d.shortfall !== undefined) {
      const f = d.shortfall;
      if (
        !f ||
        !d.closed ||
        !Number.isSafeInteger(f.amount) ||
        f.amount <= 0 ||
        typeof f.accountId !== "string" ||
        typeof f.categoryId !== "string" ||
        f.date !== d.endedAt
      )
        throw new Error("押金不足补缴记录无效");
    }
  }
  if (
    d.laterRefunds !== undefined &&
    (!Array.isArray(d.laterRefunds) ||
      !d.laterRefunds.every(
        (r: any) =>
          r &&
          typeof r.date === "string" &&
          r.date >= d.endedAt &&
          typeof r.accountId === "string" &&
          [r.rent, r.deposit].every((n) => Number.isSafeInteger(n) && n >= 0),
      ))
  )
    throw new Error("后续退款记录无效");
  if (d.archived !== undefined && typeof d.archived !== "boolean")
    throw new Error("归档状态无效");
  if (
    d.expectedReturn !== undefined &&
    d.expectedReturn !== null &&
    d.expectedReturn !== ""
  ) {
    validDate(d.expectedReturn);
    if (d.expectedReturn < d.date)
      throw new Error("预计退还日期不能早于付款日期");
  }
  return d;
}
