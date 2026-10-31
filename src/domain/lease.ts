import { addMonths } from "./finance";
import { validDate } from "./date";
import { addDays } from "./reports";
import { assertMoney } from "./money";

export type LeaseCycle = "week" | "month" | "quarter" | "year";
export const leaseCycles: Record<LeaseCycle, string> = {
  week: "按周",
  month: "按月",
  quarter: "按季",
  year: "按年",
};
export type LeaseTerms = {
  start: string;
  end: string;
  cycle: LeaseCycle;
  rent: number;
  rentChanges?: { fromPeriod: number; rent: number }[];
};
export function leaseSchedule(terms: LeaseTerms) {
  validDate(terms.start);
  validDate(terms.end);
  assertMoney(terms.rent);
  if (
    terms.start > terms.end ||
    terms.rent <= 0 ||
    !Object.prototype.hasOwnProperty.call(leaseCycles, terms.cycle)
  )
    throw new Error("租期或每期租金无效");
  const stop = addDays(terms.end, 1);
  if (terms.rentChanges !== undefined) {
    if (!Array.isArray(terms.rentChanges) || terms.rentChanges.length > 600)
      throw new Error("租金调整记录无效");
    let previous = -1;
    for (const change of terms.rentChanges) {
      if (
        !change ||
        !Number.isSafeInteger(change.fromPeriod) ||
        change.fromPeriod <= previous ||
        change.fromPeriod >= 600 ||
        !Number.isSafeInteger(change.rent) ||
        change.rent <= 0
      )
        throw new Error("租金调整记录无效");
      previous = change.fromPeriod;
    }
  }
  const result: { start: string; end: string; amount: number }[] = [];
  let total = 0;
  const boundary = (i: number): string =>
    terms.cycle === "week"
      ? addDays(terms.start, i * 7)
      : addMonths(
          terms.start,
          i * { month: 1, quarter: 3, year: 12 }[terms.cycle],
        );
  for (let i = 0, start = terms.start; start < stop; i++) {
    if (i >= 600) throw new Error("租期最多支持 600 期");
    const next = boundary(i + 1),
      end = next < stop ? next : stop;
    const rent =
      terms.rentChanges?.filter((c) => c.fromPeriod <= i).at(-1)?.rent ??
      terms.rent;
    const amount = Number(
      (BigInt(rent) * BigInt(Date.parse(end) - Date.parse(start)) +
        BigInt((Date.parse(next) - Date.parse(start)) / 2)) /
        BigInt(Date.parse(next) - Date.parse(start)),
    );
    if (amount < 1) throw new Error("末期租金不足一分钱，请调整租期或金额");
    total = assertMoney(total + amount);
    result.push({ start, end: addDays(end, -1), amount });
    start = next;
  }
  return result;
}

// Allocate each paid period over calendar months by occupied days, preserving cents.
export function leaseParts(period: {
  start: string;
  end: string;
  amount: number;
}) {
  const stop = addDays(period.end, 1);
  const days = (Date.parse(stop) - Date.parse(period.start)) / 86400000;
  let allocated = 0;
  const parts: { date: string; amount: number }[] = [];
  for (let date = period.start; date < stop;) {
    const next = addMonths(date.slice(0, 7) + "-01", 1);
    const end = next < stop ? next : stop;
    const elapsed = (Date.parse(end) - Date.parse(period.start)) / 86400000;
    const cumulative = Number(
      (BigInt(period.amount) * BigInt(elapsed)) / BigInt(days),
    );
    if (cumulative > allocated)
      parts.push({ date, amount: cumulative - allocated });
    allocated = cumulative;
    date = end;
  }
  return parts;
}

export function leaseExit(terms: LeaseTerms, paidPeriods: number, end: string) {
  validDate(end);
  const schedule = leaseSchedule(terms);
  if (
    !Number.isSafeInteger(paidPeriods) ||
    paidPeriods < 1 ||
    paidPeriods > schedule.length ||
    end < terms.start
  )
    throw new Error("退租日期或付款期数无效");
  let unused = 0;
  const parts = schedule.slice(0, paidPeriods).flatMap((period) => {
    const original = leaseParts(period);
    const stop = addDays(period.end, 1);
    const cutoff =
      end < period.start
        ? period.start
        : end < period.end
          ? addDays(end, 1)
          : stop;
    const consumed = Number(
      (BigInt(period.amount) *
        BigInt(Date.parse(cutoff) - Date.parse(period.start))) /
        BigInt(Date.parse(stop) - Date.parse(period.start)),
    );
    unused = assertMoney(unused + period.amount - consumed);
    let remaining = consumed;
    return original.map((part) => {
      const amount = Math.min(remaining, part.amount);
      remaining -= amount;
      return { ...part, originalAmount: part.amount, amount };
    });
  });
  return { unused, parts };
}
