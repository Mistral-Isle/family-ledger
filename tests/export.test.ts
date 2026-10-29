import * as XLSX from "xlsx";
import { fixture } from "./sqlite";
import { csvText, excelBytes, exportSheets } from "../src/domain/export";
import { reportRange } from "../src/domain/reports";
import { zh } from "../src/i18n/zh";
test("five-sheet export round trip filters discarded/private rows but preserves account balances", () => {
  const f = fixture();
  try {
    const s = f.repo.snapshot(),
      c = s.categories.find((c) => c.kind === "expense" && c.parentId)!;
    f.repo.saveTxn({
      type: "expense",
      amount: 1234,
      accountId: s.accounts[0]!.id,
      categoryId: c.id,
      occurredAt: "2026-10-01",
      note: "=SUM(A1:A2)",
      forWhom: "both",
    });
    const range = reportRange("month", "2026-10-01", []);
    let sheets = exportSheets(f.repo.snapshot(), range);
    expect(csvText(sheets[0]!)).toContain("'=SUM(A1:A2)");
    const book = XLSX.read(excelBytes(sheets), { type: "array" });
    expect(book.SheetNames).toHaveLength(5);
    expect(book.Sheets[zh.exports.details]!["I2"]).toMatchObject({
      t: "s",
      v: "=SUM(A1:A2)",
    });
    expect(book.Sheets[zh.exports.details]!["I2"].f).toBeUndefined();
    expect(book.Sheets[zh.exports.details]!["C2"].v).toBe(12.34);
    f.repo.deleteCategory(c.id, { action: "discard" });
    sheets = exportSheets(f.repo.snapshot(), range);
    expect(sheets[0]!.rows).toHaveLength(1);
    expect(sheets[3]!.rows[1]![3]).toBe(-12.34);
    const privateSnapshot = f.repo.snapshot();
    privateSnapshot.accounts[0]!.scope = "private";
    privateSnapshot.accounts[0]!.name = "PRIVATE_SECRET";
    privateSnapshot.txns[0]!.scope = "private";
    expect(JSON.stringify(exportSheets(privateSnapshot, range))).not.toContain(
      "PRIVATE_SECRET",
    );
  } finally {
    f.sqlite.close();
  }
});
test("CSV escapes commas, quotes and multiline values", () => {
  expect(csvText({ name: "x", rows: [["a,b", 'line\n"quoted"', " +1"]] })).toBe(
    '\uFEFF"a,b","line\n""quoted""","\' +1"',
  );
});
test("monthly budgets persist, travel in backups and reject invalid amounts", () => {
  const f = fixture(),
    other = fixture();
  try {
    f.repo.setMonthBudget("2026-10", 100000);
    other.repo.restoreBackup(f.repo.exportBackup());
    expect(other.repo.monthBudget("2026-10")).toBe(100000);
    expect(() => f.repo.setMonthBudget("2026-13", 100)).toThrow();
    expect(() => f.repo.setMonthBudget("2026-10", -1)).toThrow();
    expect(() => f.repo.setMonthBudget("2026-10", 1.5)).toThrow();
    f.repo.setMonthBudget("2026-10", null);
    expect(f.repo.monthBudget("2026-10")).toBeNull();
  } finally {
    f.sqlite.close();
    other.sqlite.close();
  }
});
