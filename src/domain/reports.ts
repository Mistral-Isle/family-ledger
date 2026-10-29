import { zh } from "../i18n/zh";
import type { CategoryKind, Snapshot, Txn } from "./types";
import { categoryAmounts, totals, visibleTxns } from "./selectors";
import { today, validDate } from "./date";
import { assertMoney } from "./money";
export type RangeMode = "week" | "month" | "year" | "all" | "custom";
export type DateRange = { start: string; end: string };
const iso = (d: Date) => d.toISOString().slice(0, 10);
export function addDays(day: string, n: number) {
  const d = new Date(validDate(day) + "T00:00:00Z");
  d.setUTCDate(d.getUTCDate() + n);
  return iso(d);
}
export function rangeDays(range: DateRange) {
  return (
    Math.round((Date.parse(range.end) - Date.parse(range.start)) / 86400000) + 1
  );
}
export function validateRange(range: DateRange) {
  validDate(range.start);
  validDate(range.end);
  if (range.start > range.end) throw new Error(zh.errors.date);
  return range;
}
export function reportRange(
  mode: RangeMode,
  anchor: string,
  txns: Txn[],
  custom?: DateRange,
): DateRange {
  if (mode === "custom") return validateRange(custom!);
  validDate(anchor);
  if (mode === "all") {
    const days = visibleTxns(txns)
      .map((t) => t.occurredAt)
      .sort();
    return { start: days[0] ?? today(), end: days.at(-1) ?? today() };
  }
  const d = new Date(anchor + "T00:00:00Z");
  if (mode === "week") {
    const start = addDays(anchor, -(d.getUTCDay() + 6) % 7);
    return { start, end: addDays(start, 6) };
  }
  if (mode === "year")
    return {
      start: anchor.slice(0, 4) + "-01-01",
      end: anchor.slice(0, 4) + "-12-31",
    };
  return {
    start: anchor.slice(0, 7) + "-01",
    end: iso(new Date(Date.UTC(d.getUTCFullYear(), d.getUTCMonth() + 1, 0))),
  };
}
export function previousRange(
  mode: RangeMode,
  range: DateRange,
): DateRange | null {
  if (mode === "all") return null;
  if (mode === "month")
    return reportRange("month", addDays(range.start, -1), []);
  if (mode === "year")
    return {
      start: `${Number(range.start.slice(0, 4)) - 1}-01-01`,
      end: `${Number(range.start.slice(0, 4)) - 1}-12-31`,
    };
  return {
    start: addDays(range.start, -rangeDays(range)),
    end: addDays(range.start, -1),
  };
}
export function rangeTxns(txns: Txn[], range: DateRange) {
  return visibleTxns(txns).filter(
    (t) => t.occurredAt >= range.start && t.occurredAt <= range.end,
  );
}
export function categoryReport(
  s: Snapshot,
  range: DateRange,
  kind: CategoryKind,
  level: "root" | "leaf",
) {
  const amounts = categoryAmounts(rangeTxns(s.txns, range), kind);
  const grouped = new Map<string, number>();
  for (const [id, amount] of amounts) {
    const c = s.categories.find((c) => c.id === id);
    const key = level === "root" ? (c?.parentId ?? id) : id;
    grouped.set(key, assertMoney((grouped.get(key) ?? 0) + amount));
  }
  return [...grouped]
    .map(([id, amount]) => ({
      category: s.categories.find((c) => c.id === id),
      id,
      amount,
    }))
    .sort((a, b) => b.amount - a.amount);
}
export function dailyReport(txns: Txn[], month: string) {
  const range = reportRange("month", month + "-01", txns);
  const rows = rangeTxns(txns, range);
  return Array.from({ length: rangeDays(range) }, (_, i) => {
    const date = addDays(range.start, i);
    return { date, ...totals(rows.filter((t) => t.occurredAt === date)) };
  });
}
export function averageExpense(expense: number, days: number) {
  // Round integer cents once, without computing a floating point monetary value.
  const n = BigInt(expense),
    d = BigInt(days),
    sign = n < 0n ? -1n : 1n;
  return assertMoney(Number(sign * ((sign * n * 2n + d) / (2n * d))));
}
export function reportingSnapshot(
  s: Snapshot,
  memberId: string,
  includeRepayments: boolean,
): Snapshot {
  const id = "report-loan-principal";
  const txns = s.txns
    .filter((t) => !memberId || t.recorderMemberId === memberId)
    .map((t) =>
      includeRepayments && t.type === "repayment"
        ? { ...t, type: "expense" as const, categoryId: id }
        : t,
    );
  return {
    ...s,
    txns,
    categories: [
      ...s.categories,
      ...(includeRepayments
        ? [
            {
              id,
              name: "贷款本金",
              kind: "expense" as const,
              parentId: null,
              icon: "building.columns.fill",
              color: "#648bd2",
              sort: 0,
              hidden: false,
              deleted: false,
              mergedInto: null,
              deleteAction: null,
              hlc: "",
              createdAt: "",
              updatedAt: "",
            },
          ]
        : []),
    ],
  };
}
