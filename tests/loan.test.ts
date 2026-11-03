import { fixture } from "./sqlite";
import {
  loanAdvance,
  loanCycleLabel,
  loanInstallment,
  loanNextAmount,
  loanProjection,
  validatePlanData,
  type LoanData,
  type LoanInput,
} from "../src/domain/finance";
import {
  accountBalance,
  loanExpenseTxns,
  totals,
} from "../src/domain/selectors";
import {
  entryAccountGroups,
  planAccountIds,
} from "../src/domain/entryAccounts";

function setup() {
  const f = fixture();
  const s = f.repo.snapshot();
  return {
    f,
    bank: s.accounts[0]!.id,
    categoryId: s.categories.find((c) => c.kind === "expense")!.id,
  };
}
const base: Omit<LoanInput, "name" | "principal" | "paymentAccountId"> = {
  date: "2024-10-01",
  receiveAccountId: null,
  oneTime: false,
  unit: "month",
  every: 1,
  periods: 1,
  installment: null,
  freePeriods: 0,
  paidPeriods: 0,
  firstDue: "",
};
const loan = (f: ReturnType<typeof fixture>) => {
  const s = f.repo.snapshot();
  const plan = s.plans.find((p) => p.kind === "loan" && !p.deleted)!;
  const d: LoanData = JSON.parse(plan.data);
  const account = s.accounts.find((a) => a.id === d.accountId)!;
  const remaining = 0 - accountBalance(account, s.txns) || 0;
  return { plan, d, account, remaining, s };
};

test("even installments keep the rounding on the last one", () => {
  expect(loanInstallment(5000000, 60)).toEqual({ each: 83333, last: 83353 });
  expect(loanInstallment(100000, 3, 40000)).toEqual({
    each: 40000,
    last: 20000,
  });
  expect(() => loanInstallment(100000, 3, 60000)).toThrow();
  expect(loanCycleLabel({ unit: "week", every: 2 })).toBe("每2周");
  expect(loanCycleLabel({})).toBe("每月");
  expect(loanCycleLabel({ oneTime: true })).toBe("一次还清");
  expect(
    loanAdvance({ unit: "week", every: 2, dueDay: 1 }, "2026-01-01", 2),
  ).toBe("2026-01-29");
  expect(
    loanAdvance({ unit: "year", every: 1, dueDay: 31 }, "2024-01-31", 1),
  ).toBe("2025-01-31");
});

test("car loan: 50,000 over 60 months, 24 interest free, paid off when the free periods end", () => {
  const { f, bank, categoryId } = setup();
  try {
    const before = accountBalance(
      f.repo.snapshot().accounts[0]!,
      f.repo.snapshot().txns,
    );
    f.repo.saveLoan({
      ...base,
      name: "车贷",
      principal: 5000000,
      paymentAccountId: bank,
      periods: 60,
      freePeriods: 24,
      firstDue: "2024-11-15",
    });
    let { d, remaining, plan, s } = loan(f);
    expect(remaining).toBe(5000000);
    expect(d.monthlyPayment).toBe(83333);
    expect(d.nextDueDate).toBe("2024-11-15");
    // Money went straight to the seller: no account balance changes.
    expect(
      accountBalance(
        s.accounts.find((a) => a.id === bank)!,
        s.txns,
      ),
    ).toBe(before);
    const end = loanProjection(
      { ...d, settlePeriod: 24 },
      remaining,
      "2024-10-01",
    );
    expect(end).toMatchObject({ deadline: "2026-10-15", amount: 3000008 });

    // Interest is not accepted inside the free periods.
    expect(() =>
      f.repo.payLoan(plan.id, {
        amount: 83333,
        interest: 100,
        date: "2024-11-15",
        categoryId,
      }),
    ).toThrow();
    for (let i = 0; i < 24; i++) {
      const date = loanAdvance(d, "2024-11-15", i);
      f.repo.payLoan(plan.id, {
        amount: loanNextAmount(loan(f).d, loan(f).remaining),
        interest: 0,
        date,
        categoryId,
      });
    }
    ({ d, remaining, plan } = loan(f));
    expect(d.paidPeriods).toBe(24);
    expect(d.nextDueDate).toBe("2026-11-15");
    expect(remaining).toBe(3000008);
    f.repo.payLoan(plan.id, {
      amount: remaining + 5000,
      interest: 5000,
      date: "2026-10-20",
      categoryId,
      settle: true,
    });
    ({ d, remaining, s } = loan(f));
    expect(d.closed).toBe(true);
    expect(remaining).toBe(0);
    expect(totals(s.txns).expense).toBe(5000);
    expect(s.accounts.find((a) => a.id === d.accountId)!.archived).toBe(true);
    expect(() => validatePlanData("loan", d)).not.toThrow();
  } finally {
    f.sqlite.close();
  }
});

test("simple one-time loan lands in an account and can be repaid in parts", () => {
  const { f, bank, categoryId } = setup();
  try {
    const bankBalance = () => {
      const s = f.repo.snapshot();
      return accountBalance(
        s.accounts.find((a) => a.id === bank)!,
        s.txns,
      );
    };
    const start = bankBalance();
    f.repo.saveLoan({
      ...base,
      name: "借小王",
      principal: 500000,
      receiveAccountId: bank,
      paymentAccountId: bank,
      oneTime: true,
    });
    let { d, remaining, plan, s } = loan(f);
    expect(bankBalance()).toBe(start + 500000);
    expect(remaining).toBe(500000);
    expect(d.nextDueDate).toBe("");
    expect(loanNextAmount(d, remaining)).toBe(500000);
    // Borrowing is a transfer, not income.
    expect(totals(s.txns).income).toBe(0);
    f.repo.payLoan(plan.id, {
      amount: 200000,
      interest: 0,
      date: "2024-12-01",
      categoryId,
    });
    ({ d, remaining } = loan(f));
    expect(d.closed).toBe(false);
    expect(remaining).toBe(300000);
    f.repo.payLoan(plan.id, {
      amount: 300000,
      interest: 0,
      date: "2025-01-01",
      categoryId,
    });
    ({ d, remaining } = loan(f));
    expect(d.closed).toBe(true);
    expect(bankBalance()).toBe(start);
  } finally {
    f.sqlite.close();
  }
});

test("every two weeks advances the due date by fourteen days", () => {
  const { f, bank, categoryId } = setup();
  try {
    f.repo.saveLoan({
      ...base,
      name: "分期",
      principal: 100000,
      paymentAccountId: bank,
      unit: "week",
      every: 2,
      periods: 3,
      firstDue: "2025-01-01",
    });
    let { d, plan, remaining } = loan(f);
    expect(d.monthlyPayment).toBe(33333);
    f.repo.payLoan(plan.id, {
      amount: 33333,
      interest: 0,
      date: "2025-01-01",
      categoryId,
    });
    f.repo.payLoan(plan.id, {
      amount: 33333,
      interest: 0,
      date: "2025-01-15",
      categoryId,
    });
    ({ d, remaining } = loan(f));
    expect(d.nextDueDate).toBe("2025-01-29");
    // The final installment clears the rounding.
    expect(loanNextAmount(d, remaining)).toBe(33334);
  } finally {
    f.sqlite.close();
  }
});

test("installments paid before recording only lower the balance", () => {
  const { f, bank } = setup();
  try {
    f.repo.saveLoan({
      ...base,
      name: "车贷",
      principal: 5000000,
      paymentAccountId: bank,
      periods: 60,
      freePeriods: 24,
      paidPeriods: 3,
      firstDue: "2024-11-15",
    });
    const { d, remaining, s } = loan(f);
    expect(d.paidPeriods).toBe(3);
    expect(d.nextDueDate).toBe("2025-02-15");
    expect(remaining).toBe(5000000 - 83333 * 3);
    expect(s.txns.filter((t) => !t.deleted)).toHaveLength(0);
  } finally {
    f.sqlite.close();
  }
});

test("editing keeps recorded repayments and deleting removes every row", () => {
  const { f, bank, categoryId } = setup();
  try {
    const input = {
      ...base,
      name: "借款",
      principal: 300000,
      receiveAccountId: bank,
      paymentAccountId: bank,
      periods: 3,
      firstDue: "2025-01-10",
    };
    f.repo.saveLoan(input);
    let { plan } = loan(f);
    f.repo.payLoan(plan.id, {
      amount: 100000,
      interest: 0,
      date: "2025-01-10",
      categoryId,
    });
    f.repo.saveLoan({ ...input, name: "借老张", principal: 600000 }, plan.id);
    let { d, remaining, s, account } = loan(f);
    expect(account.name).toBe("借老张");
    expect(d.paidPeriods).toBe(1);
    expect(d.monthlyPayment).toBe(200000);
    expect(remaining).toBe(500000);
    // The borrowing row was replaced, not duplicated.
    expect(
      s.txns.filter((t) => !t.deleted && t.type === "transfer"),
    ).toHaveLength(1);
    expect(() =>
      f.repo.saveLoan(
        { ...input, date: "2025-02-01", firstDue: "2025-02-10" },
        plan.id,
      ),
    ).toThrow();
    expect(() =>
      f.repo.saveLoan({ ...input, principal: 100000 }, plan.id),
    ).toThrow();

    f.repo.deleteLoan(plan.id);
    s = f.repo.snapshot();
    expect(s.plans.filter((p) => !p.deleted)).toHaveLength(0);
    expect(s.txns.filter((t) => !t.deleted)).toHaveLength(0);
    expect(s.accounts.find((a) => a.id === d.accountId)!.deleted).toBe(true);
  } finally {
    f.sqlite.close();
  }
});

test("loan accounts never appear as entry accounts and cannot be booked against", () => {
  const { f, bank, categoryId } = setup();
  try {
    f.repo.saveLoan({
      ...base,
      name: "车贷",
      principal: 5000000,
      paymentAccountId: bank,
      periods: 60,
      firstDue: "2024-11-15",
    });
    const s = f.repo.snapshot();
    const { d } = loan(f);
    const groups = entryAccountGroups(
      s.accounts,
      s.meId,
      planAccountIds(s.plans),
    );
    expect([...groups.mine, ...groups.more].map((a) => a.id)).not.toContain(
      d.accountId,
    );
    expect(() =>
      f.repo.saveTxn({
        type: "expense",
        amount: 100,
        accountId: d.accountId,
        categoryId,
        occurredAt: "2024-12-01",
        note: "",
        forWhom: "both",
      }),
    ).toThrow("贷款卡片");
  } finally {
    f.sqlite.close();
  }
});

test("a loan counted as spending turns each repayment into 车贷 spending without moving balances", () => {
  const { f, bank } = setup();
  try {
    f.repo.saveLoan({
      ...base,
      name: "车贷",
      principal: 300000,
      paymentAccountId: bank,
      periods: 3,
      firstDue: "2024-11-15",
      countAsExpense: true,
    });
    let { d, plan, s } = loan(f);
    const category = s.categories.find((c) => c.id === d.expenseCategoryId)!;
    const parent = s.categories.find((c) => c.id === category.parentId);
    expect([parent?.name, category.name]).toEqual(["大额支出", "车贷"]);
    f.repo.payLoan(plan.id, {
      amount: 110000,
      interest: 10000,
      date: "2024-11-15",
      categoryId: category.id,
    });
    ({ s } = loan(f));
    const bankAccount = s.accounts.find((a) => a.id === bank)!;
    const balance = accountBalance(bankAccount, s.txns);
    const spending = loanExpenseTxns(s.txns, s.plans);
    expect(totals(s.txns).expense).toBe(10000);
    expect(totals(spending).expense).toBe(110000);
    expect(
      spending
        .filter((t) => t.type === "expense")
        .every((t) => t.categoryId === category.id),
    ).toBe(true);
    expect(accountBalance(bankAccount, spending)).toBe(balance);
    // Saving again reuses the category instead of creating another.
    f.repo.saveLoan(
      {
        ...base,
        name: "车贷",
        principal: 300000,
        paymentAccountId: bank,
        periods: 3,
        firstDue: "2024-11-15",
        countAsExpense: true,
      },
      plan.id,
    );
    expect(
      f.repo.snapshot().categories.filter((c) => c.name === "车贷" && !c.deleted),
    ).toHaveLength(1);
    f.repo.saveLoan(
      {
        ...base,
        name: "车贷",
        principal: 300000,
        paymentAccountId: bank,
        periods: 3,
        firstDue: "2024-11-15",
      },
      plan.id,
    );
    ({ s } = loan(f));
    expect(totals(loanExpenseTxns(s.txns, s.plans)).expense).toBe(10000);
  } finally {
    f.sqlite.close();
  }
});
