import { assertMoney } from "./money";
import { validDate, today } from "./date";
import { leaseSchedule } from "./lease";
export type LoanData = {
  accountId: string;
  paymentAccountId: string;
  monthlyPayment: number;
  dueDay: number;
  totalPeriods: number;
  paidPeriods: number;
  interestFreePeriods: number;
  settlePeriod: number;
  nextDueDate: string;
  closed: boolean;
  txnIds?: string[];
  initialPaidPeriods?: number;
  initialNextDueDate?: string;
};
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
  if (d.initialPaidPeriods !== undefined) {
    if (
      !Number.isSafeInteger(d.initialPaidPeriods) ||
      d.initialPaidPeriods < 0 ||
      d.initialPaidPeriods > d.totalPeriods ||
      !d.initialNextDueDate
    )
      throw new Error("贷款初始期数无效");
    validDate(d.initialNextDueDate);
  }
  validDate(d.nextDueDate);
  monthDate(d.nextDueDate.slice(0, 7), d.dueDay);
  return d;
}
export function loanProjection(d: LoanData, principal: number, at = today()) {
  validateLoan(d);
  assertMoney(principal);
  if (principal < 0) throw new Error("剩余本金不能为负");
  const remaining = Math.max(0, d.settlePeriod - d.paidPeriods);
  const deadline = remaining
    ? addMonths(d.nextDueDate, remaining - 1, d.dueDay)
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
        settlement.date !== d.endedAt
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
      if (
        !d.closed ||
        d.endedAt < d.lease.start ||
        d.endedAt < d.lastPaymentDate
      )
        throw new Error("租赁结束日期无效");
    }
    if (
      d.date > d.lease.start ||
      d.lastPaymentDate < d.date ||
      d.lastPaymentDate > schedule[d.paidPeriods - 1]!.start
    )
      throw new Error("租赁付款日期无效");
  }
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
