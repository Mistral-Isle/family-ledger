import { randomUUID } from "node:crypto";
import { LedgerRepository } from "../src/db/repository";
import { summaryPreferences } from "../src/domain/summaryPreferences";
import { fixture } from "./sqlite";

test("summary choices survive reopening and backup without changing ledger or sync data", () => {
  const f = fixture();
  const restored = fixture();
  try {
    const before = f.repo.snapshot();
    const outboxBefore = f.sqlite
      .prepare("SELECT * FROM outbox ORDER BY seq")
      .all();
    expect(f.repo.getSummaryPreferences()).toEqual({
      page: "cashflow",
      cashflowMetric: "expense",
      budgetMetric: "remaining",
    });
    const chosen = {
      page: "budget",
      cashflowMetric: "balance",
      budgetMetric: "total",
    } as const;
    f.repo.setSummaryPreferences(chosen);
    const reopened = new LedgerRepository(f.driver, randomUUID);
    expect(reopened.getSummaryPreferences()).toEqual(chosen);
    expect(reopened.snapshot()).toEqual(before);
    expect(f.sqlite.prepare("SELECT * FROM outbox ORDER BY seq").all()).toEqual(
      outboxBefore,
    );
    restored.repo.restoreBackup(reopened.exportBackup());
    expect(restored.repo.getSummaryPreferences()).toEqual(chosen);
  } finally {
    f.sqlite.close();
    restored.sqlite.close();
  }
});

test("missing, legacy and unknown display choices use safe defaults independently", () => {
  for (const input of [
    null,
    undefined,
    false,
    "budget",
    {},
    { page: "other", cashflowMetric: "other", budgetMetric: "other" },
  ]) {
    expect(summaryPreferences(input)).toEqual({
      page: "cashflow",
      cashflowMetric: "expense",
      budgetMetric: "remaining",
    });
  }
  expect(
    summaryPreferences({
      page: "budget",
      cashflowMetric: "income",
      budgetMetric: "unknown",
    }),
  ).toEqual({
    page: "budget",
    cashflowMetric: "income",
    budgetMetric: "remaining",
  });
});
