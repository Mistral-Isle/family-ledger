import { addMonths } from "./finance";
import { validDate } from "./date";
import { addDays } from "./reports";
import { assertMoney } from "./money";

export type LeaseCycle = "week" | "month" | "quarter" | "year" | "custom";
export const leaseCycles: Record<LeaseCycle, string> = {
  week: "按周",
  month: "按月",
  quarter: "按季",
  year: "按年",
  custom: "自定义",
};
export type LeaseUnit = "day" | "week" | "month" | "year";
export const leaseUnits: Record<LeaseUnit, { label: string; max: number }> = {
  day: { label: "天", max: 366 },
  week: { label: "周", max: 104 },
  month: { label: "月", max: 60 },
  year: { label: "年", max: 5 },
};
type CycleTerms = Pick<LeaseTerms, "cycle" | "unit" | "every">;
/** Length of one payment period, either in days or in calendar months. */
export function leaseStep(
  terms: CycleTerms,
): { days: number } | { months: number } {
  if (terms.cycle !== "custom")
    return terms.cycle === "week"
      ? { days: 7 }
      : { months: { month: 1, quarter: 3, year: 12 }[terms.cycle] };
  const n = terms.every!;
  return terms.unit === "day"
    ? { days: n }
    : terms.unit === "week"
      ? { days: n * 7 }
      : { months: terms.unit === "year" ? n * 12 : n };
}
export function leaseCycleLabel(terms: CycleTerms) {
  return terms.cycle === "custom"
    ? `每${terms.every}${leaseUnits[terms.unit!].label}`
    : leaseCycles[terms.cycle];
}
/** "month": spread each paid period evenly over its lease months; "none": expense the whole period at its start. Older leases omit it and split by occupied days per calendar month. */
export type LeaseSplit = "month" | "none";
export type LeaseTerms = {
  start: string;
  end: string;
  cycle: LeaseCycle;
  rent: number;
  rentChanges?: { fromPeriod: number; rent: number }[];
  split?: LeaseSplit;
  /** Required for custom cycles: one payment every `every` units. */
  unit?: LeaseUnit;
  every?: number;
};
export function leaseSchedule(terms: LeaseTerms) {
  validDate(terms.start);
  validDate(terms.end);
  assertMoney(terms.rent);
  if (
    terms.start > terms.end ||
    terms.rent <= 0 ||
    !Object.prototype.hasOwnProperty.call(leaseCycles, terms.cycle) ||
    (terms.split !== undefined && !["month", "none"].includes(terms.split)) ||
    (terms.cycle === "custom"
      ? !Object.prototype.hasOwnProperty.call(leaseUnits, terms.unit ?? "") ||
        !Number.isSafeInteger(terms.every) ||
        terms.every! < 1 ||
        terms.every! > leaseUnits[terms.unit!].max
      : terms.unit !== undefined || terms.every !== undefined)
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
  const step = leaseStep(terms);
  const boundary = (i: number): string =>
    "days" in step
      ? addDays(terms.start, i * step.days)
      : addMonths(terms.start, i * step.months);
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

// Allocate each paid period to monthly expenses, preserving cents.
export function leaseParts(
  period: { start: string; end: string; amount: number },
  terms?: LeaseTerms,
) {
  const stop = addDays(period.end, 1);
  if (terms?.split === "none")
    return [{ date: period.start, amount: period.amount }];
  if (terms?.split === "month") {
    const step = leaseStep(terms),
      months = "months" in step ? step.months : 0;
    const day = Number(terms.start.slice(-2));
    const dates: string[] = [];
    for (let i = 0, date = period.start; date < stop; i++) {
      dates.push(date);
      date = addMonths(period.start, i + 1, day);
    }
    // A full period is shared equally by its months; a shortened last period by days.
    if (
      dates.length === months &&
      addMonths(period.start, months, day) === stop
    ) {
      const base = Math.floor(period.amount / months);
      return dates.map((date, i) => ({
        date,
        amount: i === months - 1 ? period.amount - base * (months - 1) : base,
      }));
    }
    const days = (Date.parse(stop) - Date.parse(period.start)) / 86400000;
    let allocated = 0;
    return dates.flatMap((date, i) => {
      const end = dates[i + 1] ?? stop;
      const cumulative = Number(
        (BigInt(period.amount) *
          BigInt((Date.parse(end) - Date.parse(period.start)) / 86400000)) /
          BigInt(days),
      );
      const amount = cumulative - allocated;
      allocated = cumulative;
      return amount > 0 ? [{ date, amount }] : [];
    });
  }
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
    const original = leaseParts(period, terms);
    const stop = addDays(period.end, 1);
    const cutoff =
      end < period.start
        ? period.start
        : end < period.end
          ? addDays(end, 1)
          : stop;
    // Newer leases keep each monthly share and prorate only the month of exit.
    if (terms.split)
      return original.map((part, i) => {
        const next = original[i + 1]?.date ?? stop;
        const amount =
          cutoff >= next
            ? part.amount
            : cutoff <= part.date
              ? 0
              : Number(
                  (BigInt(part.amount) *
                    BigInt(Date.parse(cutoff) - Date.parse(part.date))) /
                    BigInt(Date.parse(next) - Date.parse(part.date)),
                );
        unused = assertMoney(unused + part.amount - amount);
        return { ...part, originalAmount: part.amount, amount };
      });
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
