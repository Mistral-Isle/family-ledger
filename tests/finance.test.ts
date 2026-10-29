import {
  loanProjection,
  nextDue,
  splitPrepayment,
  rentSchedule,
  monthDate,
} from "../src/domain/finance";
test("planning PDF loan acceptance values", () => {
  const d = {
    accountId: "a",
    paymentAccountId: "b",
    monthlyPayment: 166667,
    dueDay: 15,
    totalPeriods: 60,
    paidPeriods: 14,
    interestFreePeriods: 24,
    settlePeriod: 24,
    nextDueDate: nextDue(15, "2026-10-29"),
    closed: false,
  };
  expect(loanProjection(d, 7666662, "2026-10-29")).toMatchObject({
    freeRemaining: 10,
    deadline: "2027-08-15",
    amount: 5999992,
    days: 290,
    estimated: false,
  });
});
test("rent example and final-installment rounding", () => {
  expect(rentSchedule(300000, 1, 3, "2026-11-01")).toMatchObject({
    deposit: 300000,
    prepaid: 900000,
    total: 1200000,
    parts: [
      { date: "2026-11-01", amount: 300000 },
      { date: "2026-12-01", amount: 300000 },
      { date: "2027-01-01", amount: 300000 },
    ],
    next: "2027-02-01",
    reminder: "2027-01-25",
  });
  expect(
    splitPrepayment(1000000, 3, "2026-11", 1).map((p) => p.amount),
  ).toEqual([333333, 333333, 333334]);
  expect(monthDate("2024-02", 31)).toBe("2024-02-29");
  expect(() => splitPrepayment(1, 3, "2026-11", 1)).toThrow();
});
