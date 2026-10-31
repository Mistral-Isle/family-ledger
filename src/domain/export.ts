import { transferAccountName } from "./privacyTransfer";
import { loanProjection, type LoanData } from "./finance";
import * as XLSX from "xlsx";
import type { Snapshot } from "./types";
import { accountBalance, totals } from "./selectors";
import {
  categoryReport,
  rangeTxns,
  validateRange,
  type DateRange,
} from "./reports";
import { moneyInput } from "./money";
import {
  tripSummary,
  effectiveTripId,
  memberName,
  payerId,
  categoryPath,
  netExpense,
} from "./travel";
import { zh } from "../i18n/zh";
type Cell = string | number;
export type ExportSheet = { name: string; rows: Cell[][] };
const currency = (cents: number): Cell =>
  Math.abs(cents) < 100000000000000
    ? Number(moneyInput(cents))
    : moneyInput(cents);
export function exportSheets(s: Snapshot, range: DateRange): ExportSheet[] {
  validateRange(range);
  const txns = rangeTxns(s.txns, range);
  const e = zh.exports;
  const category = (id: string | null | undefined) => {
    const c = s.categories.find((c) => c.id === id),
      p = s.categories.find((p) => p.id === c?.parentId);
    return [p?.name, c?.name].filter(Boolean).join(" / ");
  };
  const account = (id: string | null) => (id ? transferAccountName(s, id) : "");
  const member = (id: string) => s.members.find((m) => m.id === id)?.name ?? "";
  return [
    {
      name: e.details,
      rows: [
        [
          ...e.detailHeaders,
          zh.collaboration.payer,
          zh.collaboration.trip,
          "不计入预算",
          "不计入收支",
        ],
        ...txns.map((t) => [
          t.occurredAt,
          zh[t.type],
          currency(t.amount),
          account(t.accountId),
          account(t.toAccountId),
          category(t.categoryId),
          member(t.recorderMemberId),
          zh[
            t.forWhom === "me"
              ? "me"
              : t.forWhom === "partner"
                ? "partner"
                : "both"
          ],
          t.note,
          currency(t.type === "refund" ? t.amount - (t.refundIncome ?? 0) : 0),
          currency(t.refundIncome ?? 0),
          category(t.refundIncomeCategoryId),
          t.occurredTime ?? "",
          t.type === "expense" || t.type === "refund"
            ? memberName(s, payerId(s, t))
            : "",
          s.trips?.find((x) => x.id === effectiveTripId(s, t))?.name ?? "",
          t.excludeBudget ? "是" : "否",
          t.excludeTotals ? "是" : "否",
        ]),
      ],
    },
    {
      name: e.categories,
      rows: [
        [...e.categoryHeaders],
        ...(["expense", "income"] as const).flatMap((kind) =>
          categoryReport(s, range, kind, "leaf").map((c) => [
            zh[kind],
            category(c.id),
            currency(c.amount),
          ]),
        ),
      ],
    },
    {
      name: e.members,
      rows: [
        [...e.memberHeaders],
        ...s.members
          .filter(
            (m) => !m.deleted || txns.some((t) => t.recorderMemberId === m.id),
          )
          .map((m) => {
            const sum = totals(txns.filter((t) => t.recorderMemberId === m.id));
            return [
              m.name,
              currency(sum.expense),
              currency(sum.income),
              currency(sum.balance),
            ];
          }),
      ],
    },
    {
      name: e.accounts,
      rows: [
        [...e.accountHeaders],
        ...s.accounts
          .filter((a) => a.scope === "family" && !a.deleted)
          .map((a) => [
            a.name,
            member(a.ownerMemberId),
            range.end,
            currency(accountBalance(a, s.txns, range.end)),
            a.archived ? e.archived : e.active,
          ]),
      ],
    },
    {
      name: e.loans,
      rows: [
        [
          zh.finance.name,
          zh.finance.principal,
          zh.finance.paid,
          zh.finance.total,
          zh.finance.nextDue,
          zh.finance.settle,
          zh.finance.settlePeriod,
        ],
        ...s.plans
          .filter(
            (p) =>
              !p.deleted &&
              p.kind === "loan" &&
              s.accounts.some((a) => a.id === JSON.parse(p.data).accountId),
          )
          .map((p) => {
            const d: LoanData = JSON.parse(p.data),
              a = s.accounts.find((a) => a.id === d.accountId)!,
              principal = Math.max(0, -accountBalance(a, s.txns, range.end)),
              projection = loanProjection(d, principal, range.end);
            return [
              p.name,
              currency(principal),
              d.paidPeriods,
              d.totalPeriods,
              d.nextDueDate,
              currency(projection.amount),
              d.settlePeriod,
            ];
          }),
      ],
    },
  ];
}
export function tripExportSheets(s: Snapshot, tripId: string): ExportSheet[] {
  const trip = s.trips?.find((x) => x.id === tripId && !x.deleted);
  if (!trip) throw new Error(zh.errors.missing);
  const summary = tripSummary(s, tripId),
    c = zh.collaboration;
  return [
    {
      name: zh.exports.details,
      rows: [
        [
          c.trip,
          "日期",
          "时间",
          "类型",
          "分类",
          "金额",
          "退款抵减",
          "净消费",
          c.payer,
          "付款账户",
          c.recorder,
          "备注",
        ],
        ...summary.rows.map((t) => [
          trip.name,
          t.occurredAt,
          t.occurredTime ?? "",
          zh[t.type],
          categoryPath(s, t.categoryId),
          currency(t.amount),
          currency(t.type === "refund" ? t.amount - (t.refundIncome ?? 0) : 0),
          currency(netExpense(t)),
          memberName(s, payerId(s, t)),
          s.accounts.find((a) => a.id === t.accountId)?.name ?? "",
          memberName(s, t.recorderMemberId),
          t.note,
        ]),
      ],
    },
    {
      name: c.payer,
      rows: [
        [c.payer, c.tripTotal],
        ...summary.members.map(([id, n]) => [memberName(s, id), currency(n)]),
        ["合计", currency(summary.total)],
      ],
    },
    {
      name: zh.exports.categories,
      rows: [
        ["分类", c.tripTotal],
        ...summary.categories.map(([id, n]) => [
          categoryPath(s, id),
          currency(n),
        ]),
        ["合计", currency(summary.total)],
      ],
    },
  ];
}
// Quoting alone does not prevent spreadsheet formula execution in CSV.
export function csvText(sheet: ExportSheet) {
  const escape = (v: Cell) => {
    let text = String(v);
    if (typeof v === "string" && /^[\s]*[=+\-@\t\r]/.test(text))
      text = "'" + text;
    return '"' + text.replace(/"/g, '""') + '"';
  };
  return "\uFEFF" + sheet.rows.map((r) => r.map(escape).join(",")).join("\r\n");
}
export function excelBytes(sheets: ExportSheet[]): Uint8Array {
  const book = XLSX.utils.book_new();
  for (const sheet of sheets) {
    const ws = XLSX.utils.aoa_to_sheet(sheet.rows);
    ws["!cols"] = sheet.rows[0]!.map(() => ({ wch: 22 }));
    ws["!autofilter"] = { ref: ws["!ref"]! };
    XLSX.utils.book_append_sheet(book, ws, sheet.name);
  }
  return new Uint8Array(
    XLSX.write(book, { type: "array", bookType: "xlsx", compression: true }),
  );
}
