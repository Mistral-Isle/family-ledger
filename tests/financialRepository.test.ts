import { fixture } from "./sqlite";
import { accountBalance, totals } from "../src/domain/selectors";
import { loanProjection } from "../src/domain/finance";
describe("financial plans persist atomically", () => {
  let f: ReturnType<typeof fixture>;
  beforeEach(() => {
    f = fixture();
  });
  afterEach(() => f.sqlite.close());
  const category = () =>
    f.repo.snapshot().categories.find((c) => c.kind === "expense")!.id;
  test("loan repayment, interest, calibration and payoff keep debt and expense separate", () => {
    const bank = f.repo.snapshot().accounts[0]!.id;
    f.repo.createLoan({
      name: "贷款",
      principal: 100000,
      paymentAccountId: bank,
      monthlyPayment: 10000,
      dueDay: 15,
      totalPeriods: 12,
      paidPeriods: 0,
      interestFreePeriods: 1,
      settlePeriod: 1,
      nextDueDate: "2026-10-15",
    });
    const p = f.repo.snapshot().plans[0]!,
      d = JSON.parse(p.data);
    expect(() =>
      f.repo.payLoan(p.id, {
        amount: 10000,
        interest: 1,
        date: "2026-10-15",
        categoryId: category(),
      }),
    ).toThrow();
    f.repo.payLoan(p.id, {
      amount: 10000,
      interest: 0,
      date: "2026-10-15",
      categoryId: category(),
    });
    f.repo.payLoan(p.id, {
      amount: 10000,
      interest: 1000,
      date: "2026-10-20",
      categoryId: category(),
    });
    let s = f.repo.snapshot();
    expect(
      accountBalance(
        s.accounts.find((a) => a.id === d.accountId)!,
        s.txns,
      ),
    ).toBe(-81000);
    expect(totals(s.txns).expense).toBe(1000);
    f.repo.calibrateLoan(p.id, 80000, "2026-10-21");
    f.repo.payLoan(p.id, {
      amount: 81000,
      interest: 1000,
      date: "2026-10-22",
      categoryId: category(),
      settle: true,
    });
    s = f.repo.snapshot();
    expect(
      accountBalance(
        s.accounts.find((a) => a.id === bank)!,
        s.txns,
      ),
    ).toBe(-101000);
    expect(
      accountBalance(
        s.accounts.find((a) => a.id === d.accountId)!,
        s.txns,
      ),
    ).toBe(0);
    expect(JSON.parse(s.plans[0]!.data).closed).toBe(true);
    expect(totals(s.txns).expense).toBe(2000);
    const other = fixture();
    try {
      other.repo.restoreBackup(f.repo.exportBackup());
      expect(other.repo.snapshot()).toEqual(s);
    } finally {
      other.sqlite.close();
    }
  });
  test("rent acceptance: bank pays full amount, deposit remains asset, expenses fall in separate months", () => {
    const bank = f.repo.snapshot().accounts[0]!.id;
    f.repo.createRent({
      name: "租房",
      monthlyRent: 300000,
      depositMonths: 1,
      prepayMonths: 3,
      start: "2026-11-01",
      paymentAccountId: bank,
      categoryId: category(),
    });
    const s = f.repo.snapshot();
    expect(
      accountBalance(
        s.accounts.find((a) => a.id === bank)!,
        s.txns,
        "2026-11-01",
      ),
    ).toBe(-1200000);
    expect(
      accountBalance(
        s.accounts.find((a) => a.kind === "deposit")!,
        s.txns,
        "2026-11-30",
      ),
    ).toBe(300000);
    expect(
      accountBalance(
        s.accounts.find((a) => a.kind === "prepaid")!,
        s.txns,
        "2026-11-30",
      ),
    ).toBe(600000);
    expect(
      accountBalance(
        s.accounts.find((a) => a.kind === "prepaid")!,
        s.txns,
        "2027-01-01",
      ),
    ).toBe(0);
    for (const month of ["2026-11", "2026-12", "2027-01"])
      expect(
        totals(s.txns.filter((t) => t.occurredAt.startsWith(month))).expense,
      ).toBe(300000);
  });
  test("deposit partial return charges only withheld amount and archives the deposit", () => {
    const bank = f.repo.snapshot().accounts[0]!.id;
    f.repo.createDeposit({
      name: "押金",
      amount: 300000,
      paymentAccountId: bank,
      date: "2026-10-01",
    });
    const p = f.repo.snapshot().plans[0]!;
    f.repo.closeDeposit(p.id, 250000, bank, category(), "2026-10-20");
    const s = f.repo.snapshot();
    expect(totals(s.txns).expense).toBe(50000);
    expect(accountBalance(s.accounts[0]!, s.txns)).toBe(-50000);
    expect(s.accounts.find((a) => a.kind === "deposit")!.archived).toBe(true);
  });
  test("whole prepayment edits and deletion restore bank balance; partial deletes blocked", () => {
    const input = {
      name: "分摊",
      amount: 1000000,
      paymentAccountId: f.repo.snapshot().accounts[0]!.id,
      categoryId: category(),
      date: "2026-10-01",
      startMonth: "2026-10",
      months: 3,
      day: 1,
    };
    f.repo.savePrepayment(input);
    const p = f.repo.snapshot().plans[0]!;
    expect(() => f.repo.deleteTxn(JSON.parse(p.data).txnIds[1])).toThrow();
    f.repo.savePrepayment({ ...input, id: p.id, amount: 600000 });
    let s = f.repo.snapshot();
    expect(accountBalance(s.accounts[0]!, s.txns)).toBe(-600000);
    expect(totals(s.txns).expense).toBe(600000);
    f.repo.deletePrepayment(p.id);
    s = f.repo.snapshot();
    expect(accountBalance(s.accounts[0]!, s.txns)).toBe(0);
    expect(totals(s.txns).expense).toBe(0);
  });
  test("rent creation rolls back all accounts, transactions and plans on failure", () => {
    const before = f.repo.snapshot();
    f.sqlite.exec(
      "CREATE TRIGGER fail BEFORE INSERT ON plan WHEN NEW.kind='prepaid' BEGIN SELECT RAISE(ABORT,'forced'); END",
    );
    expect(() =>
      f.repo.createRent({
        name: "租房",
        monthlyRent: 300000,
        depositMonths: 1,
        prepayMonths: 3,
        start: "2026-11-01",
        paymentAccountId: before.accounts[0]!.id,
        categoryId: category(),
      }),
    ).toThrow("forced");
    expect(f.repo.snapshot()).toEqual(before);
  });
  test("version one backups upgrade with empty plan table", () => {
    const backup = JSON.parse(f.repo.exportBackup());
    delete backup.tables.plan;
    delete backup.tables.budget;
    backup.version = 1;
    f.repo.restoreBackup(JSON.stringify(backup));
    expect(f.repo.snapshot().plans).toEqual([]);
  });
});
