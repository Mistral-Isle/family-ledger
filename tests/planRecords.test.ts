import { fixture } from "./sqlite";
import { leftoverRecords, planRowRemoval } from "../src/domain/planRecords";
import { accountBalance, totals } from "../src/domain/selectors";
import type { LoanData } from "../src/domain/finance";

function setup() {
  const f = fixture();
  const s = f.repo.snapshot();
  return {
    f,
    bank: s.accounts[0]!,
    categoryId: s.categories.find((c) => c.kind === "expense")!.id,
  };
}
const balance = (f: ReturnType<typeof fixture>, id: string) => {
  const s = f.repo.snapshot();
  return accountBalance(
    s.accounts.find((a) => a.id === id)!,
    s.txns,
  );
};
const lease = (f: ReturnType<typeof fixture>) =>
  f.repo
    .snapshot()
    .plans.find(
      (p) => p.kind === "prepaid" && !p.deleted && JSON.parse(p.data).lease,
    )!;
const newLease = (
  f: ReturnType<typeof fixture>,
  bank: string,
  categoryId: string,
) =>
  f.repo.createLease({
    name: "公寓",
    paymentAccountId: bank,
    categoryId,
    lease: {
      start: "2026-01-15",
      end: "2027-01-14",
      cycle: "quarter",
      rent: 900000,
      split: "month",
    },
    deposit: 0,
    date: "2026-01-10",
  });

test("a repayment deleted from the details takes its interest along and reopens the loan", () => {
  const { f, bank, categoryId } = setup();
  try {
    f.repo.saveLoan({
      name: "借款",
      principal: 200000,
      date: "2025-01-01",
      receiveAccountId: null,
      paymentAccountId: bank.id,
      oneTime: false,
      unit: "month",
      every: 1,
      periods: 2,
      installment: null,
      freePeriods: 0,
      paidPeriods: 0,
      firstDue: "2025-02-01",
    });
    const plan = f.repo.snapshot().plans.find((p) => p.kind === "loan")!;
    f.repo.payLoan(plan.id, {
      amount: 100000,
      interest: 0,
      date: "2025-02-01",
      categoryId,
    });
    f.repo.payLoan(plan.id, {
      amount: 105000,
      interest: 5000,
      date: "2025-03-01",
      categoryId,
      settle: true,
    });
    let s = f.repo.snapshot();
    let d: LoanData = JSON.parse(s.plans.find((p) => p.id === plan.id)!.data);
    expect(d.closed).toBe(true);
    const last = s.txns.find(
      (t) => t.type === "repayment" && t.occurredAt === "2025-03-01",
    )!;
    const interest = s.txns.find((t) => t.type === "expense")!;
    // Starting from the interest row finds the same repayment.
    expect(planRowRemoval(s, interest.id)).toMatchObject({
      ids: [last.id, interest.id],
    });
    // Repayments of a live loan stay guarded in plain deletes.
    expect(() => f.repo.deleteTxn(last.id)).toThrow();
    f.repo.undoPlanRow(last.id);
    s = f.repo.snapshot();
    d = JSON.parse(s.plans.find((p) => p.id === plan.id)!.data);
    expect(d.closed).toBe(false);
    expect(d.paidPeriods).toBe(1);
    expect(d.nextDueDate).toBe("2025-03-01");
    expect(totals(s.txns).expense).toBe(0);
    expect(balance(f, d.accountId)).toBe(-100000);
    expect(s.accounts.find((a) => a.id === d.accountId)!.archived).toBe(false);
  } finally {
    f.sqlite.close();
  }
});

test("only the latest lease payment can be undone, together with its rent parts", () => {
  const { f, bank, categoryId } = setup();
  try {
    newLease(f, bank.id, categoryId);
    let plan = lease(f);
    f.repo.payLease(plan.id, 1, "2026-04-08", bank.id);
    f.repo.payLease(plan.id, 2, "2026-07-08", bank.id);
    const s = f.repo.snapshot();
    const transfers = s.txns.filter((t) => t.type === "transfer" && !t.deleted);
    const [first, second, third] = transfers;
    expect(planRowRemoval(s, first!.id)).toMatchObject({
      error: expect.stringContaining("首期"),
    });
    expect(planRowRemoval(s, second!.id)).toMatchObject({
      error: expect.stringContaining("最近一期"),
    });
    const removal = planRowRemoval(s, third!.id);
    expect(removal).toMatchObject({
      title: "撤销第 3 期交租？",
      detail: expect.stringContaining("3 笔"),
    });
    const before = balance(f, bank.id);
    // Starting from one of the spread rows undoes the whole payment.
    const part = s.txns.find(
      (t) => t.type === "expense" && t.occurredAt === "2026-07-15",
    )!;
    f.repo.undoPlanRow(part.id);
    plan = lease(f);
    const d = JSON.parse(plan.data);
    expect(d.paidPeriods).toBe(2);
    expect(d.lastPaymentDate).toBe("2026-04-08");
    expect(balance(f, bank.id)).toBe(before + 900000);
    expect(
      f.repo.snapshot().txns.filter((t) => !t.deleted && t.type === "expense"),
    ).toHaveLength(6);
    // Paying again continues from the restored period.
    f.repo.payLease(plan.id, 2, "2026-07-09", bank.id);
    expect(JSON.parse(lease(f).data).paidPeriods).toBe(3);
  } finally {
    f.sqlite.close();
  }
});

test("accounts and rows left by removed leases can be cleaned up", () => {
  const { f, bank, categoryId } = setup();
  try {
    newLease(f, bank.id, categoryId);
    const old = JSON.parse(lease(f).data).accountId;
    const start = balance(f, bank.id) + 900000;
    f.repo.deleteLease(lease(f).id);
    // Deleting a lease now removes its holding account outright.
    expect(f.repo.snapshot().accounts.find((a) => a.id === old)!.deleted).toBe(
      true,
    );
    expect(leftoverRecords(f.repo.snapshot()).accounts).toHaveLength(0);
    // Older versions only archived it, and could leave a stray payment into it.
    const account = f.repo.snapshot().accounts.find((a) => a.id === old)!;
    (f.repo as any).write("account", {
      ...account,
      ...(f.repo as any).stamp(account),
      deleted: false,
      archived: true,
    });
    (f.repo as any).financialTxn({
      type: "transfer",
      amount: 50000,
      accountId: bank.id,
      toAccountId: old,
      occurredAt: "2026-02-01",
    });
    let left = leftoverRecords(f.repo.snapshot());
    expect(left.accounts.map((a) => a.id)).toEqual([old]);
    expect(left.txns).toHaveLength(1);
    // Leftover rows delete like any other row.
    expect(() => f.repo.deleteTxn(left.txns[0]!.id)).not.toThrow();
    f.repo.removeLeftovers();
    left = leftoverRecords(f.repo.snapshot());
    expect(left.accounts).toHaveLength(0);
    expect(left.txns).toHaveLength(0);
    expect(balance(f, bank.id)).toBe(start);
    expect(f.repo.snapshot().accounts.find((a) => a.id === old)!.deleted).toBe(
      true,
    );
  } finally {
    f.sqlite.close();
  }
});

test("undoing a lease's only payment removes the whole lease after a clear warning", () => {
  const { f, bank, categoryId } = setup();
  try {
    const start = balance(f, bank.id);
    newLease(f, bank.id, categoryId);
    const s = f.repo.snapshot();
    const transfer = s.txns.find((t) => t.type === "transfer" && !t.deleted)!;
    expect(planRowRemoval(s, transfer.id)).toMatchObject({
      wholePlan: true,
      title: "删除整个租赁？",
    });
    f.repo.undoPlanRow(transfer.id);
    const after = f.repo.snapshot();
    expect(after.plans.filter((p) => !p.deleted)).toHaveLength(0);
    expect(after.txns.filter((t) => !t.deleted)).toHaveLength(0);
    expect(balance(f, bank.id)).toBe(start);
  } finally {
    f.sqlite.close();
  }
});
