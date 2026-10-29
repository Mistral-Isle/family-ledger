import { reportingSnapshot } from "../src/domain/reports";
import { totals } from "../src/domain/selectors";
import { fixture } from "./sqlite";
test("member and loan reporting filters do not change balances or include private records", () => {
  const f = fixture();
  try {
    const s = f.repo.snapshot();
    f.repo.createLoan({
      name: "贷款",
      principal: 100000,
      paymentAccountId: s.accounts[0]!.id,
      monthlyPayment: 10000,
      dueDay: 15,
      totalPeriods: 12,
      paidPeriods: 0,
      interestFreePeriods: 2,
      settlePeriod: 2,
    });
    const p = f.repo.snapshot().plans[0]!;
    f.repo.payLoan(p.id, {
      amount: 10000,
      interest: 0,
      date: "2026-10-29",
      categoryId: s.categories.find((c) => c.kind === "expense")!.id,
    });
    const snapshot = f.repo.snapshot();
    expect(totals(snapshot.txns).expense).toBe(0);
    expect(totals(reportingSnapshot(snapshot, s.meId, true).txns).expense).toBe(
      10000,
    );
    expect(
      totals(reportingSnapshot(snapshot, "other", true).txns).expense,
    ).toBe(0);
    expect(snapshot.txns[0]!.type).toBe("repayment");
  } finally {
    f.sqlite.close();
  }
});
