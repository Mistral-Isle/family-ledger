import { fixture } from "./sqlite";
import { financialReminders } from "../src/domain/reminders";
test("local reminders use Beijing 9 AM, omit expired reminders and stop closed plans", () => {
  const f = fixture();
  try {
    const s = f.repo.snapshot();
    f.repo.createLoan({
      name: "车贷",
      principal: 100000,
      paymentAccountId: s.accounts[0]!.id,
      monthlyPayment: 10000,
      dueDay: 15,
      totalPeriods: 12,
      paidPeriods: 0,
      interestFreePeriods: 3,
      settlePeriod: 3,
      nextDueDate: "2026-11-15",
    });
    f.repo.savePrepayment({
      name: "租金",
      amount: 90000,
      paymentAccountId: s.accounts[0]!.id,
      categoryId: s.categories.find((c) => c.kind === "expense")!.id,
      date: "2026-11-01",
      startMonth: "2026-11",
      months: 3,
      day: 1,
    });
    const rows = financialReminders(
      f.repo.snapshot(),
      new Date("2026-10-30T00:00:00Z"),
    );
    expect(rows.map((r) => r.date.toISOString())).toEqual([
      "2026-11-12T01:00:00.000Z",
      "2026-12-16T01:00:00.000Z",
      "2027-01-08T01:00:00.000Z",
      "2027-01-25T01:00:00.000Z",
    ]);
    expect(
      financialReminders(f.repo.snapshot(), new Date("2027-02-01T00:00:00Z")),
    ).toEqual([]);
    const snapshot = f.repo.snapshot();
    snapshot.plans = snapshot.plans.map((p) => ({
      ...p,
      data: JSON.stringify({ ...JSON.parse(p.data), closed: true }),
    }));
    expect(financialReminders(snapshot, new Date("2026-10-30"))).toEqual([]);
  } finally {
    f.sqlite.close();
  }
});
